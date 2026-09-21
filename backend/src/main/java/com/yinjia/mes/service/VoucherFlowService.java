package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 选单流转引擎(对齐 PANDA「选单弹窗T+对齐补丁」的占用语义,适配本项目 JDBC 架构):
 * - sources:已审核来源单据 + form_flow_link 占用过滤(行级 _lineKey/已生单数量/剩余数量)
 * - link:生单后写占用(ACTIVE),来源行不再出现在选单列表;批量分批场景用 linkBatch(带批次号 + 本次量)
 * - release:删除/作废下游单据时释放(RELEASED),来源行重新可选(ButtonService.delete 钩子调用)
 *
 * 2026-09-20 分批送料(P0,docs/方案-采购订单分批送料与批次号.md):
 * - 已送量按**来源单**汇总(不再按"来源→目标"限定),否则同一采购订单既走暂收又走直接入库会重复计量;
 * - 剩余量 = 订单行数量 − Σ有效批次送料量 + **Σ已审核退回单的退货数量**(退货回冲,决策 4);
 * - 另给 可送上限 = 剩余量 ×(1 + 超送比例),供分批生单与选单界面校验(决策 2)。
 */
@Service
public class VoucherFlowService {

    /** 数量字段候选(按面板习惯命名,命中即用) */
    private static final String[] QTY_FIELDS = {"数量", "实收数量", "计划数量", "派工数量", "需用数量", "领料数量"};
    /** 存货编码字段候选 */
    private static final String[] INV_FIELDS = {"存货编码", "产品编码", "材料编码", "物料代码"};
    /** 来源行号字段候选(退货回冲按订单行号匹配) */
    private static final String[] LINE_NO_FIELDS = {"行号", "采购订单行号", "源单行号"};

    private final JdbcTemplate jdbc;
    private final QueryService queryService;
    private final PanelRegistry registry;
    private final BatchService batchService;

    public VoucherFlowService(JdbcTemplate jdbc, QueryService queryService, PanelRegistry registry,
                              BatchService batchService) {
        this.jdbc = jdbc;
        this.queryService = queryService;
        this.registry = registry;
        this.batchService = batchService;
    }

    /** 选单来源:已审核 + 未完全占用的行(带 _lineKey/已生单数量/已退回数量/剩余数量/可送上限) */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sources(String sourcePanel, String targetPanel,
                                       Map<String, Object> condition, int pageNo, int pageSize) {
        // 单据状态不作为 SQL 列条件(状态由工作流注册表推导,物理列可能滞后);
        // 先全量查询,再按 loadDocs 合并出的单据状态在 Java 侧过滤"已审核"。
        Map<String, Object> cond = new LinkedHashMap<>(condition == null ? Map.of() : condition);
        cond.remove("单据状态");
        Map<String, Object> result = queryService.queryFormDataList(sourcePanel, null, cond, pageNo, pageSize);
        double overRatio = batchService.overRatio();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : (List<Object>) result.getOrDefault("list", List.of())) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> doc = (Map<String, Object>) o;
            if (!"已审核".equals(String.valueOf(doc.get("单据状态")))) continue;
            String no = String.valueOf(doc.get("编号"));
            Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, no);
            Map<String, Double> returned = batchService.returnedByOrderLine(no);
            List<Map<String, Object>> items = detailItems(doc);
            List<Map<String, Object>> remain = new ArrayList<>();
            for (Map<String, Object> item : items) {
                String lineKey = lineKey(no, item);
                item.put("_lineKey", lineKey);
                double qty = qtyOf(item);
                double used = sent.getOrDefault(lineKey, 0.0);
                double ret = returned.getOrDefault(lineNoOf(item), 0.0);
                double left = qty - used + ret;
                item.put("已生单数量", round(used));
                item.put("已退回数量", round(ret));
                item.put("剩余数量", round(Math.max(0, left)));
                item.put("可送上限", round(Math.max(0, left) * (1 + overRatio)));
                if (qty <= 0 || left > 0.000001) remain.add(item);
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

    /** 生单后写占用:按 targetOffset 把来源行与目标行一一对应落 link(整行量语义,非分批链路沿用) */
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

    /**
     * 分批送料占用(2026-09-20 P0):按调用方给出的「来源行 → 本次送料量 → 目标行」逐行落 link,并带批次号。
     * 关键差异:`linked_quantity` = **本次实际送料量**(不是来源行整行量),这样剩余量能按批次逐次核减。
     * 2026-09-21 取号时机迁移:生成时批次号还没取(采购入库单审核时才取),batchNo 传 null,
     * 由 **batchId(批次键)** 兜住 —— 取号后 `UPDATE form_flow_link SET batch_no=? WHERE batch_id=?` 一并回填。
     */
    public void linkBatch(String sourcePanel, String sourceNo, String targetPanel, String targetNo,
                          String batchNo, Integer batchId, List<BatchLine> lines) {
        String user = currentUser();
        for (BatchLine l : lines) {
            jdbc.update("INSERT INTO form_flow_link (source_panel_code, source_form_no, source_line_key,"
                            + " target_panel_code, target_form_no, target_line_key, inventory_code,"
                            + " source_quantity, linked_quantity, batch_no, batch_id, link_status, create_by)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?)",
                    sourcePanel, sourceNo, l.sourceLineKey(), targetPanel, targetNo, l.targetLineKey(),
                    l.inventoryCode(), l.sourceQty(), l.qty(), batchNo, batchId, user);
        }
    }

    /** 分批占用的一行:来源行键 / 目标行键 / 存货编码 / 来源行订单量 / 本次送料量 */
    public record BatchLine(String sourceLineKey, String targetLineKey, String inventoryCode,
                            double sourceQty, double qty) { }

    /** 释放占用(删除/作废下游单据):link 置 RELEASED,来源行重新可选。
     *  2026-09-21 取号时机迁移:批次台账**不再回收**(批次号在采购入库单审核时已定,回收会重号,
     *  用户口径「弃审/作废不回收批次号」)—— batchService.releaseByTarget 现为不回收实现。 */
    public void release(String targetPanel, String targetFormNo) {
        try {
            jdbc.update("UPDATE form_flow_link SET link_status='RELEASED', release_time=SYSDATETIME()"
                            + " WHERE target_panel_code = ? AND target_form_no = ? AND link_status = 'ACTIVE'",
                    targetPanel, targetFormNo);
        } catch (Exception ignore) { /* 表未建等场景不阻断删除 */ }
        batchService.releaseByTarget(targetPanel, targetFormNo);
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

    /** 来源行的行号(退货回冲按「采购订单行号」匹配;无行号返回空串=不回冲) */
    private String lineNoOf(Map<String, Object> item) {
        for (String f : LINE_NO_FIELDS) {
            Object v = item.get(f);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return "";
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
