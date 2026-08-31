package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelRegistry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 门户壳接口:工厂列表/菜单/dashboard(角标与通知在 PortalController) */
@RestController
@RequestMapping("/api")
public class ShellController {

    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;

    public ShellController(PanelRegistry registry, JdbcTemplate jdbc) {
        this.registry = registry;
        this.jdbc = jdbc;
    }

    @GetMapping("/base/factory/list")
    public ApiResult<List<Map<String, Object>>> factories() {
        Map<String, Object> f = new HashMap<>();
        f.put("code", "YJ");
        f.put("name", "YINJIA-MES");
        return ApiResult.ok(List.of(f));
    }

    @GetMapping("/sys/menu/tree")
    public ApiResult<List<Map<String, Object>>> menuTree() {
        return ApiResult.ok(List.of());
    }

    @GetMapping("/dashboard/stats")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> dashboard() {
        Map<String, Object> out = new HashMap<>();
        Map<String, Object> kpis = new HashMap<>();
        List<Map<String, Object>> docStats = new ArrayList<>();
        int draftTotal = 0;
        int auditTotal = 0;
        try {
            for (PanelRegistry.PanelDef def : registry.all()) {
                if (!def.isDoc()) continue;
                String table = def.hasHeadTable() ? def.headTable() : def.lineTable();
                Integer docs = jdbc.queryForObject(
                        "SELECT COUNT(DISTINCT " + def.groupCol() + ") FROM " + table
                                + " WHERE ISNULL(asp_cancel,'N')<>'Y'", Integer.class);
                Integer audited = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = ? AND shr IS NOT NULL"
                                + " AND ISNULL(canceled,'N')<>'Y'", Integer.class, def.code());
                int d = docs == null ? 0 : docs;
                int a = audited == null ? 0 : audited;
                draftTotal += d - a;
                auditTotal += a;
                Map<String, Object> row = new HashMap<>();
                row.put("panelName", def.name());
                row.put("panelCode", def.code());
                row.put("count", d);
                Map<String, Object> st = new HashMap<>();
                st.put("草稿", d - a);
                st.put("已审核", a);
                row.put("status", st);
                docStats.add(row);
            }
        } catch (Exception ignored) {
        }
        kpis.put("moActive", draftTotal);
        kpis.put("approvePending", 0);
        Map<String, Object> archives = new HashMap<>();
        try {
            Integer mates = jdbc.queryForObject(
                    "SELECT COUNT(DISTINCT m_no) FROM mate WHERE ISNULL(asp_cancel,'N')<>'Y'", Integer.class);
            archives.put("invItems", mates == null ? 0 : mates);
        } catch (Exception e) {
            archives.put("invItems", 0);
        }
        out.put("kpis", kpis);
        out.put("archives", archives);
        out.put("docStats", docStats);
        out.put("todos", List.of());
        out.put("latest", List.of());
        out.put("progress", List.of());
        out.put("production", Map.of("bomTree", List.of()));
        out.put("stock", Map.of("panels", List.of()));
        out.put("sales", Map.of("byStatus", List.of()));
        out.put("quality", Map.of("total", 0, "pass", 0, "passRate", 0, "byResult", List.of()));
        return ApiResult.ok(out);
    }
}
