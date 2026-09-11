package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 标准库接口(可自行补充,不写死):规格书章节库(spec.section)/检验项目自定义(spec.test)等。
 * yj_std_lib(lib_code, item_code, content):条目正文为纯文本或 JSON,按 lib+item 分组;
 * 读取需登录,新增/停用记录操作人(asp_user1)。
 */
@RestController
@RequestMapping("/api/stdlib")
public class StdLibController {

    private final JdbcTemplate jdbc;

    public StdLibController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 条目列表:GET /api/stdlib/list?lib=spec.section&item=1.适用范围(item 缺省=整库)。
     * all=1 时连**停用**条目一起返回并下发 enabled —— 维护界面要靠它显示灰显条目并恢复启用;
     * 默认(不带 all)只给 enabled=1,即下拉候选,停用条目不得出现在业务选择里。
     */
    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list(@RequestParam String lib,
                                                     @RequestParam(required = false) String item,
                                                     @RequestParam(required = false) String all) {
        boolean includeDisabled = all != null && !all.isBlank() && !"0".equals(all) && !"false".equalsIgnoreCase(all);
        StringBuilder sql = new StringBuilder(
                "SELECT id, lib_code AS lib, item_code AS item, content, enabled FROM yj_std_lib WHERE lib_code = ?");
        if (!includeDisabled) {
            sql.append(" AND enabled = 1");
        }
        Object[] args;
        if (item != null && !item.isBlank()) {
            sql.append(" AND item_code = ? ORDER BY seq, id");
            args = new Object[]{lib, item};
        } else {
            sql.append(" ORDER BY item_code, seq, id");
            args = new Object[]{lib};
        }
        return ApiResult.ok(jdbc.queryForList(sql.toString(), args));
    }

    /** 新增条目:POST {lib, item, content} —— 当前登录人记录。 */
    @PostMapping("/add")
    public ApiResult<Map<String, Object>> add(@RequestBody Map<String, Object> body) {
        String username = currentUsername();
        String lib = str(body.get("lib"));
        String item = str(body.get("item"));
        String content = str(body.get("content"));
        if (lib.isBlank() || item.isBlank() || content.isBlank()) {
            return ApiResult.error(400, "lib/item/content 不能为空");
        }
        if (content.length() > 4000) {
            return ApiResult.error(400, "内容过长(≤4000 字)");
        }
        jdbc.update("INSERT INTO yj_std_lib (lib_code, item_code, content, asp_user1, asp_time1) VALUES (?,?,?,?,SYSDATETIME())",
                lib, item, content, username);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        return ApiResult.ok(out);
    }

    /** 停用条目(软删):POST {id}。 */
    @PostMapping("/remove")
    public ApiResult<Map<String, Object>> remove(@RequestBody Map<String, Object> body) {
        return setEnabled(body, 0);
    }

    /**
     * 编辑条目正文:POST {id, content} —— 只改标准库条目本身。
     * 面板勾选录入时存的是**文本内容**(单据列不存条目 id),所以改库条目**不会**改到历史单据,
     * 这正是"不污染已录入数据"的口径;改完只影响以后的勾选候选。
     * content 允许纯文本或 JSON(spec.test/insp.plan 存结构化 JSON,原样往返不解析)。
     */
    @PostMapping("/update")
    public ApiResult<Map<String, Object>> update(@RequestBody Map<String, Object> body) {
        String username = currentUsername();
        Object id = body.get("id");
        if (!(id instanceof Number n)) {
            return ApiResult.error(400, "id 无效");
        }
        String content = str(body.get("content"));
        if (content.isBlank()) {
            return ApiResult.error(400, "内容不能为空");
        }
        if (content.length() > 4000) {
            return ApiResult.error(400, "内容过长(≤4000 字)");
        }
        int rows = jdbc.update("UPDATE yj_std_lib SET content = ?, asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                content, username, n.intValue());
        if (rows == 0) {
            return ApiResult.error(404, "条目不存在");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("id", n.intValue());
        out.put("content", content);
        return ApiResult.ok(out);
    }

    /** 恢复启用:POST {id}(停用是软删,可救回)。 */
    @PostMapping("/enable")
    public ApiResult<Map<String, Object>> enable(@RequestBody Map<String, Object> body) {
        return setEnabled(body, 1);
    }

    private ApiResult<Map<String, Object>> setEnabled(Map<String, Object> body, int enabled) {
        String username = currentUsername();
        Object id = body.get("id");
        if (!(id instanceof Number n)) {
            return ApiResult.error(400, "id 无效");
        }
        int rows = jdbc.update("UPDATE yj_std_lib SET enabled = ?, asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?",
                enabled, username, n.intValue());
        if (rows == 0) {
            return ApiResult.error(404, "条目不存在");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("id", n.intValue());
        out.put("enabled", enabled);
        return ApiResult.ok(out);
    }

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "" : String.valueOf(auth.getName());
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
