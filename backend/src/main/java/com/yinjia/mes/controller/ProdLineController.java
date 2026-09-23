package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 生产线档案行内开关(2026-09-23 用户拍板:停用列用按钮,点一下立即切换,不走整单保存)。
 * 权限:PROD_LINE 可见 + 编辑权(保存词表)。
 */
@RestController
@RequestMapping("/api/px/prodLine")
public class ProdLineController {

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    public ProdLineController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    /** 停用/启用 切换:{生产线};点一下翻转状态并返回('1'=停用,'0'=启用);停用后从排产台消失、排入被拦 */
    @PostMapping("/toggle")
    public ApiResult<Map<String, Object>> toggle(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("PROD_LINE");
        perm.requireButton("PROD_LINE", "保存");
        Object noObj = body == null ? null : body.get("生产线");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少 生产线");
        String line = String.valueOf(noObj).trim();
        String user = currentUser();
        int n = jdbc.update(
                "UPDATE bs_prod_line SET [停用] = CASE WHEN ISNULL([停用],0) = 1 THEN 0 ELSE 1 END,"
                        + " asp_user2 = ?, asp_time2 = SYSDATETIME()"
                        + " WHERE [生产线] = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                user, line);
        if (n == 0) throw new IllegalStateException("生产线不存在:" + line);
        Integer state = jdbc.queryForObject(
                "SELECT CASE WHEN ISNULL([停用],0) = 1 THEN 1 ELSE 0 END FROM bs_prod_line WHERE [生产线] = ?",
                Integer.class, line);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("生产线", line);
        out.put("停用", state == null ? 0 : state);
        return ApiResult.ok(out);
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
