package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 选单流转引擎(对齐 PANDA「选单弹窗T+对齐补丁」的占用语义,适配本项目 JDBC 架构):
 * - sources:已审核来源单据 + form_flow_link 占用过滤(行级 _lineKey/已生单数量/剩余数量)
 * - link:生单后写占用(ACTIVE),来源行不再出现在选单列表
 * - release:删除下游草稿时释放(RELEASED),来源行重新可选(ButtonService.delete 钩子调用)
 */
@Service
public class VoucherFlowService {

    /** 数量字段候选(按面板习惯命名,命中即用) */
    private static final String[] QTY_FIELDS = {"数量", "实收数量", "计划数量", "派工数量", "需用数量", "领料数量"};
    /** 存货编码字段候选 */
    private static final String[] INV_FIELDS = {"存货编码", "产品编码", "材料编码", "物料代码"};

    private final JdbcTemplate jdbc;
    private final QueryService queryService;
    private final PanelRegistry registry;

    public VoucherFlowService(JdbcTemplate jdbc, QueryService queryService, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.queryService = queryService;
        this.registry = registry;
    }

    /** 选单来源:已审核 + 未完全占用的行(带 _lineKey/已生单数量/剩余数量) */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sources(String sourcePanel, String targetPanel,
                                       Map<String, Object> condition, int pageNo, int pageSize) {
        // 单据状态不作为 SQL 列条件(状态由工作流注册表推导,物理列可能滞后);
        // 先全量查询,再按 loadDocs 合并出的单据状态在 Java 侧过滤"已审核"。
        Map<String, Object> cond = new LinkedHashMap<>(condition == null ? Map.of() : condition);
        cond.remove("单据状态");
        Map<String, Object> result = queryService.queryFormDataList(sourcePanel, null, cond, pageNo, pageSize);
        Map<String, Double> consumed = loadConsumed(sourcePanel, targetPanel);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : (List<Object>) result.getOrDefault("list", List.of())) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> doc = (Map<String, Object>) o;
            if (!"已审核".equals(String.valueOf(doc.get("单据状态")))) continue;
            String no = String.valueOf(doc.get("编号"));
            List<Map<String, Object>> items = detailItems(doc);
            List<Map<String, Object>> remain = new ArrayList<>();
            for (Map<String, Object> item : items) {
                String lineKey = lineKey(no, item);
                item.put("_lineKey", lineKey);
                double qty = qtyOf(item);
                double used = consumed.getOrDefault(no + "|" + lineKey, 0.0);
                item.put("已生单数量", round(used));
                item.put("剩余数量", round(Math.max(0, qty - used)));
                if (qty <= 0 || qty - used > 0.000001) remain.add(item);
            }
            if (remain.isEmpty()) continue;
            doc.put("detail", Map.of("items", remain));
            out.add(doc);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("totalSize", out.size());
        resp.put("list", out);
        return resp;
    }

    /** 生单后写占用:按 targetOffset 把来源行与目标行一一对应落 link */
    public void link(String sourcePanel, String sourceNo, String sourceKey,
                     String targetPanel, String targetNo, String targetKey,
                     int targetOffset, String businessType) {
        List<Map<String, Object>> sourceItems = detailItems(loadDoc(sourcePanel, sourceNo));
        List<Map<String, Object>> targetItems = detailItems(loadDoc(targetPanel, targetNo));
        String user = currentUser();
        for (int i = 0; i < sourceItems.size(); i++) {
            Map<String, Object> src = sourceItems.get(i);
            Map<String, Object> tgt = targetOffset + i < targetItems.size() ? targetItems.get(targetOffset + i) : null;
            double qty = qtyOf(src);
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_detail_key, source_line_key,"
                            + " target_panel_code, target_form_no, target_detail_key, target_line_key,"
                            + " inventory_code, source_quantity, linked_quantity, link_status, create_by)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?)",
                    sourcePanel, sourceNo, sourceKey, lineKey(sourceNo, src),
                    targetPanel, targetNo, targetKey, tgt == null ? null : lineKey(targetNo, tgt),
                    invCodeOf(src), qty, qty, user);
        }
    }

    /** 删除/作废下游单据时释放占用,来源行重新可选 */
    public void release(String targetPanel, String targetFormNo) {
        try {
            jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                    + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'",
                    targetPanel, targetFormNo);
        } catch (Exception ignore) { /* 表未建等场景不阻断删除 */ }
    }

    // ============ 内部 ============

    private Map<String, Object> loadDoc(String panelCode, String docNo) {
        return queryService.loadOneDoc(registry.panel(panelCode), docNo);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> detailItems(Map<String, Object> doc) {
        Object d = doc == null ? null : doc.get("detail");
        if (!(d instanceof Map)) return List.of();
        Object items = ((Map<String, Object>) d).get("items");
        if (!(items instanceof List)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : (List<Object>) items) {
            if (o instanceof Map) out.add((Map<String, Object>) o);
        }
        return out;
    }

    private Map<String, Double> loadConsumed(String sourcePanel, String targetPanel) {
        Map<String, Double> out = new HashMap<>();
        try {
            jdbc.query("SELECT source_form_no, source_line_key, SUM(COALESCE(linked_quantity,0)) FROM form_flow_link"
                            + " WHERE source_panel_code = ? AND target_panel_code = ? AND link_status = 'ACTIVE'"
                            + " GROUP BY source_form_no, source_line_key",
                    rs -> {
                        out.put(rs.getString(1) + "|" + rs.getString(2), rs.getDouble(3));
                    }, sourcePanel, targetPanel);
        } catch (Exception ignore) { /* 表未建时视为无占用 */ }
        return out;
    }

    private String lineKey(String docNo, Map<String, Object> item) {
        Object id = item.get("id");
        return docNo + "#" + (id == null ? String.valueOf(System.identityHashCode(item)) : String.valueOf(id));
    }

    private double qtyOf(Map<String, Object> item) {
        for (String f : QTY_FIELDS) {
            Object v = item.get(f);
            if (v instanceof Number) return ((Number) v).doubleValue();
            if (v != null) {
                try { return Double.parseDouble(String.valueOf(v).trim()); } catch (Exception ignore) { }
            }
        }
        return 0;
    }

    private String invCodeOf(Map<String, Object> item) {
        for (String f : INV_FIELDS) {
            Object v = item.get(f);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
        }
        return null;
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
