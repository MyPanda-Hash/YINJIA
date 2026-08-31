package com.yinjia.mes.controller;

import com.yinjia.mes.config.JwtUtil;
import com.yinjia.mes.dto.ApiResult;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    public AuthController(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.encoder = encoder;
    }

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String username = body.getOrDefault("userName", "");
        String password = body.getOrDefault("password", "");
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, password_hash, real_name, is_admin FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty() || !encoder.matches(password, String.valueOf(rows.get(0).get("password_hash")))) {
            throw new IllegalStateException("用户名或密码错误");
        }
        Map<String, Object> u = rows.get(0);
        boolean admin = "Y".equals(u.get("is_admin"));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("roleCode", admin ? "admin" : "user");
        user.put("isAdmin", admin);
        user.put("visiblePanels", List.of("*"));
        // 审批权限(照搬 light-mes can_approve 语义):仅管理员可审批通过/驳回
        user.put("approvePanels", admin ? List.of("*") : List.of());
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
                "SELECT username, real_name, is_admin FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty()) throw new IllegalStateException("用户不存在");
        Map<String, Object> u = rows.get(0);
        boolean admin = "Y".equals(u.get("is_admin"));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("roleCode", admin ? "admin" : "user");
        user.put("isAdmin", admin);
        user.put("visiblePanels", List.of("*"));
        user.put("approvePanels", admin ? List.of("*") : List.of());
        return user;
    }
}
