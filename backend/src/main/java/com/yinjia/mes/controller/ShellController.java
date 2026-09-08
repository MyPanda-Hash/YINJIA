package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
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

    /** 仓库下拉:引用基础档案·仓库面板明细(bs_wh,按仓库编码绑定,字典改名不影响);
     *  仅列启用且未停用的仓库 */
    @GetMapping("/base/warehouse/list")
    public ApiResult<List<Map<String, Object>>> warehouses() {
        return ApiResult.ok(jdbc.query(
                "SELECT [仓库编码] AS code, [仓库名称] AS name FROM bs_wh"
                        + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([停用],0) <> 1 AND [状态] = N'启用' ORDER BY id",
                (rs, i) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("code", rs.getString("code"));
                    m.put("name", rs.getString("name"));
                    return m;
                }));
    }

    /** 我的桌面·研发管理:修改申请动态(待审批) + 各文件面板最新单据 + 档案本面板清单 */
    @GetMapping("/dashboard/rd")
    public ApiResult<Map<String, Object>> rdBoard() {
        Map<String, Object> out = new HashMap<>();
        List<Map<String, Object>> mods = new ArrayList<>();
        try {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT TOP 20 panel_code, doc_no, modify_req_by, modify_req_at FROM yj_doc_status"
                            + " WHERE ISNULL(modify_state,'') = 'R' AND ISNULL(canceled,'N') <> 'Y' ORDER BY modify_req_at DESC")) {
                Map<String, Object> m = new HashMap<>();
                m.put("panelCode", r.get("panel_code"));
                m.put("panelName", panelNameOf(String.valueOf(r.get("panel_code"))));
                m.put("docNo", r.get("doc_no"));
                m.put("by", r.get("modify_req_by"));
                m.put("at", r.get("modify_req_at"));
                mods.add(m);
            }
        } catch (Exception ignored) {
        }
        List<Map<String, Object>> newDocs = new ArrayList<>();
        List<Map<String, Object>> panels = new ArrayList<>();
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (!ButtonService.DOC_ARCHIVE_PANELS.contains(def.code()) || !def.hasHeadTable()) continue;
            Map<String, Object> p = new HashMap<>();
            p.put("code", def.code());
            p.put("name", def.name());
            panels.add(p);
            try {
                newDocs.addAll(jdbc.queryForList(
                        "SELECT TOP 5 '" + def.code() + "' AS panelCode, N'" + def.name().replace("'", "''") + "' AS panelName"
                                + ", t.[" + def.groupCol() + "] AS docNo, t.asp_user1 AS creator, t.asp_time1 AS at"
                                + " FROM " + def.headTable() + " t WHERE ISNULL(t.asp_cancel,'N') <> 'Y' ORDER BY t.asp_time1 DESC"));
            } catch (Exception ignored) {
            }
        }
        newDocs.sort((a, b) -> String.valueOf(b.get("at")).compareTo(String.valueOf(a.get("at"))));
        out.put("modifyRequests", mods);
        out.put("newDocs", newDocs.size() > 20 ? newDocs.subList(0, 20) : newDocs);
        out.put("panels", panels);
        return ApiResult.ok(out);
    }

    private String panelNameOf(String code) {
        try {
            PanelRegistry.PanelDef d = registry.panel(code);
            return d == null ? code : d.name();
        } catch (Exception e) {
            return code;
        }
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
