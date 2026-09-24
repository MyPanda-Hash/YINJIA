package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产排产域服务(2026-09-22 面板化改造后仅保留跨面板复用的两段核心):
 * ① 销售订单 → 生产加工单({@link #generateFromOrder}/{@link #createFromOrderLine},SO_ORDER「生成生产加工单」按钮);
 * ② 生产加工单排产({@link #scheduleOne},MANU_ORDER「排产」按钮):就地回写产线/车间/开工·完工日/重点管控,
 *    数量守恒(排产数量≤本单生单量,form_flow_link.linked_quantity 跟随)、余量=排产−入库(头级优先)、排产留痕。
 * 界面层(待生单/排单计划表/负荷看板)不再走专用页——由 SO_ORDER/MANU_ORDER/MANU_SCHEDULE/LINE_CAP/LINE_LOAD 面板承担,
 * 流转 = 面板按钮生单/跳转(gotoPanel),对齐全系统面板↔面板范式。
 */
@Service
public class QuickScheduleService {

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    private final PanelConfigService configService;

    public QuickScheduleService(JdbcTemplate jdbc, PanelRegistry registry, QueryService queryService,
                                ButtonService buttonService, VoucherFlowService voucherFlow,
                                PanelConfigService configService) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.configService = configService;
    }

    // ────────────────────────── ① 销售订单 → 生产加工单(一单可多次生成多张) ──────────────────────────

    /** 整单按行生成加工单草稿(增量:剩余为 0 的行跳过),返回新单号;支持同一行反复点击多次生成 */
    @Transactional
    @SuppressWarnings("unchecked")
    public List<String> generateFromOrder(String sourceNo, String user) {
        requireAudited(sourceNo);
        PanelRegistry.PanelDef soDef = registry.panel("SO_ORDER");
        Map<String, Object> src = queryService.loadOneDoc(soDef, sourceNo);
        Object detailObj = src.get("detail");
        List<Map<String, Object>> lines = new ArrayList<>();
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) lines.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        if (lines.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生成生产加工单");
        List<String> created = new ArrayList<>();
        for (Map<String, Object> line : lines) {
            String lineId = str(line.get("id"));
            if (lineId == null) continue;
            if (residual(sourceNo, lineId, line) <= 0.0001) continue;   // 剩余为 0:已生成的行跳过
            created.add(createFromOrderLine(sourceNo, lineId, null, user));
        }
        if (created.isEmpty()) throw new IllegalStateException("该订单明细行均已生成生产加工单,无需重复生成(如需调整请先删除对应加工单草稿)");
        return created;
    }

    /** 单行 → 一张加工单草稿 + 行级占用;qtyOverride 空=剩余全部 */
    @Transactional
    @SuppressWarnings("unchecked")
    public String createFromOrderLine(String sourceNo, String lineId, Double qtyOverride, String user) {
        requireAudited(sourceNo);
        PanelRegistry.PanelDef soDef = registry.panel("SO_ORDER");
        Map<String, Object> src = queryService.loadOneDoc(soDef, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        Object detailObj = head.remove("detail");
        Map<String, Object> line = null;
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) {
                if (o instanceof Map<?, ?> m && lineId.equals(str(m.get("id")))) {
                    line = new LinkedHashMap<>((Map<String, Object>) m);
                    break;
                }
            }
        }
        if (line == null) throw new IllegalStateException("订单行不存在:" + sourceNo + "#" + lineId);
        double residual = residual(sourceNo, lineId, line);
        if (residual <= 0.0001) {
            throw new IllegalStateException("该订单行已全部生成生产加工单(剩余可生成数量 0);如需调整请先删除对应加工单草稿");
        }
        double qty = qtyOverride != null && qtyOverride > 0 ? qtyOverride : residual;
        if (qty <= 0) throw new IllegalStateException("生单数量必须大于 0");
        if (qty > residual + 0.0001) throw new IllegalStateException("生单数量 " + qty + " 超过剩余可生成数量 " + residual);
        double demand = qtyOf(line);   // 需求数量=订单行数量,不随部分生单缩水

        Map<String, Object> maps = configService.flowMaps("SO_ORDER", "MANU_ORDER");
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:MANU_ORDER");
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");

        PanelRegistry.PanelDef tgtDef = registry.panel("MANU_ORDER");
        String dateLabel = "单据日期";
        if (tgtDef.dateCol() != null && !tgtDef.dateCol().isBlank()) {
            PanelRegistry.FieldDef df = tgtDef.byCol(tgtDef.dateCol());
            if (df != null) dateLabel = df.label();
        }

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put("来源单据", soDef.name());
        targetHead.put("来源单号", sourceNo);
        targetHead.put(dateLabel, java.time.LocalDate.now().toString());
        targetHead.put("需求数量", demand);
        targetHead.put("排产数量", qty);

        Map<String, Object> row = new LinkedHashMap<>();
        for (Map<String, String> m : detailMap) {
            Object v = line.get(m.get("from"));
            if (v != null) row.put(m.get("to"), v);
        }
        if (row.containsKey("数量")) row.put("数量", qty);
        row.put("需求数量", demand);
        row.put("排产数量", qty);

        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", List.of(row)));
        Map<String, Object> saved = buttonService.save(tgtDef, formData, false);
        String newNo = String.valueOf(saved.get("编号"));
        voucherFlow.linkLine("SO_ORDER", sourceNo, sourceNo + "#" + lineId, str(row.get("产品编码")), qty,
                "MANU_ORDER", newNo, newNo + "#0", "");
        return newNo;
    }

    // ────────────────────────── ② 生产加工单排产(排产工作台单一入口,2026-09-23 §5) ──────────────────────────

    /**
     * 排产(带参数):排产工作台把 生产线/排产班组/预开工日/预完工日/行 排产数量·每箱数量 写入后(生产车间=产线档案属性,2026-09-23 下线),
     * 再走核心守卫+数量守恒+留痕。参数可空=沿用单上现值;MANU_ORDER 表单的 生产线/预开工日/预完工日 已转只读。
     */
    @Transactional
    public Map<String, Object> scheduleOne(String no, Map<String, Object> p, String user) {
        if (p != null && !p.isEmpty()) {
            String line = str(p.get("生产线"));
            String team = str(p.get("排产班组"));
            String start = str(p.get("预开工日"));
            String end = str(p.get("预完工日"));
            if (start != null && end != null && end.compareTo(start) < 0) {
                throw new IllegalStateException("预完工日不能早于预开工日(" + start + " → " + end + ")");
            }
            if (line != null) {
                jdbc.update("UPDATE bd_manu_order SET [生产线]=?, [排产班组]=COALESCE(?, [排产班组]),"
                                + "[预开工日]=COALESCE(?, [预开工日]),"
                                + " [预完工日]=COALESCE(?, [预完工日]) WHERE [合同号]=?",
                        line, team, date(start), date(end), no);
            }
            Double qty = num(p.get("排产数量"));
            Double box = num(p.get("每箱数量"));
            if ((qty != null && qty > 0) || (box != null && box > 0)) {
                jdbc.update("UPDATE bl_manu_order SET [排产数量]=COALESCE(?, [排产数量]), [每箱数量]=COALESCE(?, [每箱数量])"
                                + " WHERE [合同号]=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        (qty != null && qty > 0) ? qty : null, (box != null && box > 0) ? box : null, no);
            }
        }
        return scheduleOne(no, user);
    }

    private static java.time.LocalDate date(String s) {
        return s == null || s.isBlank() ? null : java.time.LocalDate.parse(s);
    }

    /**
     * 单张加工单排产(核心):读加工单上的 生产线/预开工日/预完工日 + 行 排产数量/每箱数量,就地回写执行信息。
     * 守卫:**仅已审核可排**(排产台口径 §5,草稿不进池);未作废/未中止/未结案;生产线必填;
     * 排产数量≤本单生单量(占用守恒:linked_quantity 跟随);留痕 asp_user2/time2 + yj_usage_log。
     */
    @Transactional
    public Map<String, Object> scheduleOne(String no, String user) {
        Map<String, Object> head;
        try {
            head = jdbc.queryForMap(
                    "SELECT h.[合同号], ISNULL(h.[生产线],N'') AS 生产线,"
                            + " ISNULL(h.[重点管控],N'') AS 重点管控, ISNULL(h.[结案],N'N') AS 结案,"
                            + " ISNULL(h.asp_cancel,N'N') AS asp_cancel, ISNULL(h.[入库数量],0) AS 头入库,"
                            + " (SELECT TOP 1 CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
                            + "   WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                            + "   WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END"
                            + "  FROM yj_doc_status s WHERE s.panel_code='MANU_ORDER' AND s.doc_no=h.[合同号]) AS 单据状态"
                            + " FROM bd_manu_order h WHERE h.[合同号] = ?", no);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new IllegalStateException("生产加工单不存在:" + no);
        }
        String status = str(head.get("单据状态"));
        if ("已作废".equals(status)) throw new IllegalStateException("该加工单已作废,不能排产");
        if ("已中止".equals(status)) throw new IllegalStateException("该加工单已中止,不能排产;如需排产请先恢复");
        if ("Y".equals(str(head.get("结案")))) throw new IllegalStateException("该加工单已结案,不能排产");
        if (!"已审核".equals(status)) {
            throw new IllegalStateException("仅已审核加工单可排产(当前:" + status + ");请先在生产加工单面板审核");
        }
        String line = str(head.get("生产线"));
        if (line == null) throw new IllegalStateException("请先指定生产线(排产工作台顶部参数或行内选择)");

        jdbc.update("UPDATE bd_manu_order SET [操作员]=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE [合同号]=?",
                user, user, no);

        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT l.[id] AS 行id, ISNULL(l.[排产数量],0) AS 排产数量, ISNULL(l.[每箱数量],0) AS 每箱数量,"
                        + " ISNULL(l.[数量],0) AS 本单数量, ISNULL(l.[入库数量],0) AS 行入库"
                        + " FROM bl_manu_order l WHERE l.[合同号]=? AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]", no);
        if (lines.isEmpty()) throw new IllegalStateException("加工单无有效明细行,不能排产");
        Double cap = jdbc.queryForObject(
                "SELECT TOP 1 source_quantity FROM form_flow_link"
                        + " WHERE target_panel_code='MANU_ORDER' AND target_form_no=? AND link_status='ACTIVE' ORDER BY id",
                Double.class, no);
        boolean touched = false;
        for (Map<String, Object> l : lines) {
            double qty = Num.of(l.get("排产数量")) > 0 ? Num.of(l.get("排产数量")) : Num.of(l.get("本单数量"));
            if (qty <= 0) continue;
            if (cap != null && qty > cap + 0.0001) {
                throw new IllegalStateException("排产数量 " + qty + " 超过本单生单量 " + cap + "(如需增产请对同一订单行再生成一张加工单)");
            }
            double inQty = Num.of(head.get("头入库")) > 0 ? Num.of(head.get("头入库")) : Num.of(l.get("行入库"));
            jdbc.update("UPDATE bl_manu_order SET [余量]=? WHERE [合同号]=? AND [id]=?", qty - inQty, no, l.get("行id"));
            if (cap != null) {
                jdbc.update("UPDATE form_flow_link SET linked_quantity=?"
                                + " WHERE target_panel_code='MANU_ORDER' AND target_form_no=? AND link_status='ACTIVE'",
                        qty, no);
            }
            touched = true;
        }
        if (!touched) throw new IllegalStateException("排产数量与本单数量均为 0,请先填写排产数量");
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, event_type, panel_name, action_name, doc_no, created_at)"
                            + " VALUES (?, N'排产', N'生产加工单', N'排产', ?, GETDATE())", user, no);
        } catch (Exception ignore) { /* 留痕失败不阻断 */ }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", no);
        out.put("生产线", line);
        out.put("gotoPanel", "MANU_SCHEDULE");   // 2026-09-23 起「生产排产」菜单下线(改「工单排产」看板);当前唯一调用方=排产工作台 assign(回执自带,不用 gotoPanel),此键保留兼容旧调用
        return out;
    }

    // ────────────────────────── 工具 ──────────────────────────

    /** 订单行剩余可生单数量 = 行数量 − 已占用 */
    private double residual(String sourceNo, String lineId, Map<String, Object> line) {
        Double linked = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND source_form_no=? AND source_line_key=? AND link_status='ACTIVE'",
                Double.class, sourceNo, sourceNo + "#" + lineId);
        return qtyOf(line) - (linked == null ? 0 : linked);
    }

    private void requireAudited(String sourceNo) {
        Map<String, Object> st = buttonService.docStatus("SO_ORDER", sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核客户订单可生成生产加工单,当前状态:" + status);
    }

    private static double qtyOf(Map<String, Object> line) {
        for (String f : List.of("数量", "订单数量", "需求数量")) {
            Object v = line.get(f);
            if (v == null) continue;
            if (v instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(v).trim()); } catch (NumberFormatException ignore) { }
        }
        return 0;
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static Double num(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return null;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static final class Num {
        static double of(Object o) {
            if (o == null) return 0;
            if (o instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
        }
    }
}
