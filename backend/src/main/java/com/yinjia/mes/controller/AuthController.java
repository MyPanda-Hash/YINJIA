package com.yinjia.mes.controller;

import com.yinjia.mes.config.DataSourceRouter;
import com.yinjia.mes.config.JwtUtil;
import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.UsageLogService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 认证接口(账号存 HSDZ_MES.yj_user,首次启动自动种子 admin/123456) */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate jdbc;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder encoder;
    private final UsageLogService usageLog;
    /** 本服务器是否提供"测试账套"(yinjia.enable-test-ledger,默认开) */
    private final boolean testLedgerEnabled;

    public AuthController(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder encoder, UsageLogService usageLog,
                          @org.springframework.beans.factory.annotation.Value("${yinjia.enable-test-ledger:true}") boolean testLedgerEnabled) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.encoder = encoder;
        this.usageLog = usageLog;
        this.testLedgerEnabled = testLedgerEnabled;
    }

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String username = body.getOrDefault("userName", "");
        String password = body.getOrDefault("password", "");
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }
        // ADR-0003(一系统两账套):登录页所选工厂决定这次登录**查哪个库** —— 账号与口令两账套各自独立,
        // 且令牌签发时把工厂写进声明,后续请求由 JwtAuthFilter 按声明路由。改选工厂必须重登。
        // ⚠ 本方法走 permitAll、请求上没有 Bearer 令牌,故 JwtAuthFilter 不会代劳设上下文与清理,
        //   必须在这里自己 use() + finally clear()(容器线程复用,不清会把下一次请求带进错误的库)。
        String factory = DataSourceRouter.TEST.equals(body.get("factory"))
                ? DataSourceRouter.TEST : DataSourceRouter.PROD;
        // 本服务器关掉了测试账套(没有 HSDZ_MES_TEST)时**提前拒绝**:否则会走到建连失败,
        // 用户看到的是 "服务异常:Failed to obtain JDBC Connection"(2026-09-22 服务器实测)。
        if (DataSourceRouter.TEST.equals(factory) && !testLedgerEnabled) {
            throw new IllegalArgumentException("本服务器未启用测试账套(如需使用,请让运维在服务端打开 yinjia.enable-test-ledger)");
        }
        DataSourceRouter.use(factory);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT username, password_hash, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
            if (rows.isEmpty() || !encoder.matches(password, String.valueOf(rows.get(0).get("password_hash")))) {
                throw new IllegalStateException("用户名或密码错误");
            }
            // 过渡期收口:存量 BCrypt 哈希在登录成功时顺手升级成自写格式(
            // BCrypt 不可逆、拿不到明文,只能借"用户自己带明文来登录"这一次机会换掉)
            upgradeStoredHashIfNeeded(username, password, String.valueOf(rows.get(0).get("password_hash")));
            Map<String, Object> u = rows.get(0);
            boolean admin = "Y".equals(u.get("is_admin"));
            // 使用记录:登录成功事件(失败不记);按所选账套记入对应库
            usageLog.recordLogin(username, String.valueOf(u.get("real_name")), clientIp(request));
            Map<String, Object> user = new HashMap<>();
            user.put("userName", u.get("username"));
            user.put("realName", u.get("real_name"));
            user.put("roleCode", admin ? "admin" : "user");
            user.put("isAdmin", admin);
            user.put("factory", factory);
            user.put("visiblePanels", visiblePanelsOf(admin, u.get("role_id")));
            // 审批权限面板:管理员=全部;普通用户=角色勾了审批(yj_role_panel.can_approve)的面板
            user.put("approvePanels", approvePanelsOf(admin, u.get("role_id")));
            Map<String, Object> out = new HashMap<>();
            out.put("token", jwtUtil.generate(username, factory));
            out.put("user", user);
            return ApiResult.ok(out);
        } finally {
            DataSourceRouter.clear();
        }
    }

    @GetMapping("/perms")
    public ApiResult<Map<String, Object>> perms() {
        Map<String, Object> user = currentUser();
        Map<String, Object> out = new HashMap<>();
        out.put("roleCode", user.get("roleCode"));
        out.put("isAdmin", user.get("isAdmin"));
        out.put("visiblePanels", user.get("visiblePanels"));
        out.put("approvePanels", user.get("approvePanels"));
        return ApiResult.ok(out);
    }

    @GetMapping("/userinfo")
    public ApiResult<Map<String, Object>> userinfo() {
        return ApiResult.ok(currentUser());
    }

    private Map<String, Object> currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null) throw new IllegalStateException("未登录");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty()) throw new IllegalStateException("用户不存在");
        Map<String, Object> u = rows.get(0);
        boolean admin = "Y".equals(u.get("is_admin"));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("roleCode", admin ? "admin" : "user");
        user.put("isAdmin", admin);
        // 账套(工厂):取自本次请求的线程上下文 —— JwtAuthFilter 按令牌声明设置的,就是"这个请求正在查哪个库"。
        // 2026-09-22 补:原先这里不含 factory,前端启动时用本响应覆盖 mes_user,
        // 会把登录时带进来的 factory 抹掉,顶栏账套名只能靠可能陈旧的 localStorage 缓存 —— 又是"显示与实查不一致"的老坑。
        user.put("factory", DataSourceRouter.current());
        user.put("visiblePanels", visiblePanelsOf(admin, u.get("role_id")));
        user.put("approvePanels", approvePanelsOf(admin, u.get("role_id")));
        return user;
    }

    /** 可见面板(角色口径):管理员=全部("*");普通用户=yj_role_panel 中勾了可见(view)的面板码。
     *  前端 filterMenuTree 据此保留面板叶子,分组节点在子项全不可见时隐藏(= 有可见面板才显示模块)。 */
    private List<String> visiblePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND perms LIKE '%view%'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /** 审批权限面板:管理员=全部;普通用户=角色勾了审批(面板权限含 audit → can_approve='Y')的面板码 */
    private List<String> approvePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND can_approve = 'Y'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /**
     * 过渡期收口:库里的存量哈希若仍是旧格式(BCrypt),借"用户带着明文来登录"这一次机会
     * 重新编码成自写格式写回。BCrypt 不可逆,除此之外没有任何办法拿到明文换算法。
     * 失败绝不影响本次登录(只打日志)——升级是锦上添花,不是登录的前提。
     */
    private void upgradeStoredHashIfNeeded(String username, String rawPassword, String storedHash) {
        try {
            if (!encoder.upgradeEncoding(storedHash)) return;
            String upgraded = encoder.encode(rawPassword);
            jdbc.update("UPDATE yj_user SET password_hash = ? WHERE username = ?", upgraded, username);
        } catch (RuntimeException e) {
            System.err.println("[login] 存量口令哈希升级失败(不影响本次登录): " + e.getMessage());
        }
    }

    /** 客户端 IP(直连内网部署,取 remoteAddr 即可;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
