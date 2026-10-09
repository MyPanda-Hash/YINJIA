package com.yinjia.mes.controller;

import com.yinjia.mes.config.DataSourceRouter;
import com.yinjia.mes.config.JwtUtil;
import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.AuthService;
import com.yinjia.mes.service.UsageLogService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.HashMap;
import java.util.Map;

/** 认证接口(账号存 HSDZ_MES.yj_user,首次启动自动种子 admin/123456) */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final JwtUtil jwtUtil;
    private final UsageLogService usageLog;
    /** 本服务器是否提供"测试账套"(yinjia.enable-test-ledger,默认开) */
    private final boolean testLedgerEnabled;

    public AuthController(AuthService auth, JwtUtil jwtUtil, UsageLogService usageLog,
                          @org.springframework.beans.factory.annotation.Value("${yinjia.enable-test-ledger:true}") boolean testLedgerEnabled) {
        this.auth = auth;
        this.jwtUtil = jwtUtil;
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
            Map<String, Object> u = auth.findForLogin(username);
            String storedHash = u == null ? null : String.valueOf(u.get("password_hash"));
            if (u == null || !auth.passwordMatches(password, storedHash)) {
                throw new IllegalStateException("用户名或密码错误");
            }
            // 过渡期收口:存量 BCrypt 哈希在登录成功时顺手升级成自写格式(
            // BCrypt 不可逆、拿不到明文,只能借"用户自己带明文来登录"这一次机会换掉)
            auth.upgradeStoredHashIfNeeded(username, password, storedHash);
            boolean admin = "Y".equals(u.get("is_admin"));
            // 使用记录:登录成功事件(失败不记);按所选账套记入对应库
            usageLog.recordLogin(username, String.valueOf(u.get("real_name")), clientIp(request));
            Map<String, Object> user = new HashMap<>();
            user.put("userName", u.get("username"));
            user.put("realName", u.get("real_name"));
            user.put("roleCode", admin ? "admin" : "user");
            user.put("isAdmin", admin);
            user.put("factory", factory);
            user.put("visiblePanels", auth.visiblePanelsOf(admin, u.get("role_id")));
            // 审批权限面板:管理员=全部;普通用户=角色勾了审批(yj_role_panel.can_approve)的面板
            user.put("approvePanels", auth.approvePanelsOf(admin, u.get("role_id")));
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
        Map<String, Object> u = auth.findProfile(username);
        if (u == null) throw new IllegalStateException("用户不存在");
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
        user.put("visiblePanels", auth.visiblePanelsOf(admin, u.get("role_id")));
        user.put("approvePanels", auth.approvePanelsOf(admin, u.get("role_id")));
        return user;
    }

    /** 客户端 IP(直连内网部署,取 remoteAddr 即可;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
