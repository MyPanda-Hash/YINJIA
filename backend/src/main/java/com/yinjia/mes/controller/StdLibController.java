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

    /** 条目列表:GET /api/stdlib/list?lib=spec.section&item=1.适用范围(item 缺省=整库)。 */
    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list(@RequestParam String lib,
                                                     @RequestParam(required = false) String item) {
        StringBuilder sql = new StringBuilder(
                "SELECT id, lib_code AS lib, item_code AS item, content FROM yj_std_lib WHERE enabled = 1 AND lib_code = ?");
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
        String username = currentUsername();
        Object id = body.get("id");
        if (!(id instanceof Number n)) {
            return ApiResult.error(400, "id 无效");
        }
        jdbc.update("UPDATE yj_std_lib SET enabled = 0, asp_user2 = ?, asp_time2 = SYSDATETIME() WHERE id = ?", username, n.intValue());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
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
