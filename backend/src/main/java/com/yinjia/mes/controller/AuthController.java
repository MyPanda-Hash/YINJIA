package com.yinjia.mes.controller;

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

    public AuthController(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder encoder, UsageLogService usageLog) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.encoder = encoder;
        this.usageLog = usageLog;
    }

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String username = body.getOrDefault("userName", "");
        String password = body.getOrDefault("password", "");
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, password_hash, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty() || !encoder.matches(password, String.valueOf(rows.get(0).get("password_hash")))) {
            throw new IllegalStateException("用户名或密码错误");
        }
        // 使用记录:登录成功事件(失败不记)
        usageLog.recordLogin(username, String.valueOf(u.get("real_name")), clientIp(request));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("roleCode", admin ? "admin" : "user");
        user.put("isAdmin", admin);
        user.put("visiblePanels", visiblePanelsOf(admin, u.get("role_id")));
        // 审批权限面板:管理员=全部;普通用户=角色勾了审批(yj_role_panel.can_approve)的面板
        user.put("approvePanels", approvePanelsOf(admin, u.get("role_id")));
        Map<String, Object> out = new HashMap<>();
        out.put("token", jwtUtil.generate(username));
        out.put("user", user);
        return ApiResult.ok(out);
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
        return buildUser(rows.get(0));
    }

    /**
     * 组装用户信息(角色 + 面板权限)。
     * 可见/审批面板来自角色配置表 yj_role_panel(组织架构「面板操作权限」保存的数据):
     * - 管理员:visiblePanels/approvePanels = ["*"](前端按 isAdmin 放行,"*" 仅作标记);
     * - 普通角色:visible = perms 含 view 的面板(勾任何权限都隐含可见);审批 = can_approve='Y'。
     * 此前此处硬编码 visiblePanels=["*"]、roleCode 只有 admin/user,角色配置完全不生效,
     * 导致配置过权限的用户登录后看不到任何功能面板(只显示默认菜单)。
     */
    private Map<String, Object> buildUser(Map<String, Object> u) {
        boolean admin = "Y".equals(u.get("is_admin"));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("isAdmin", admin);
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

    /** 客户端 IP(直连内网部署,取 remoteAddr 即可;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
