package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 采购订单分批送料:批次号取号 / 批次台账 / 行级已送量与退货回冲(P0,2026-09-20)。
 *
 * 口径(见 docs/方案-采购订单分批送料与批次号.md):
 * - 批次号 = `采购订单号-3位序号`(如 YJ-20260915-08-001);**序号可回收** —— 取该订单当前"有效批次"
 *   (台账现存行)中最小的未占用序号,删除下游草稿时台账行随之删除、序号回到可用池。
 * - **一张暂收单 = 一个批次**(决策 3):台账 target_* 指向生成的那张暂收单。
 * - 可送量(按订单行) = 订单行数量 − Σ有效批次送料量 + Σ退货数量(退货回冲,决策 4);
 *   退货只认**已审核且未作废**的暂收退回单(QC_RETURN),退货行按「采购订单行号」回到对应订单行。
 * - 允许超送:上限 = 剩余量 ×(1 + yj_app_setting.receive_over_ratio)(决策 2)。
 *
 * 台账生命周期:reserve(取号占位)→ bind(生成成功绑定单据与数量)/ drop(生成失败回收序号);
 *   删除下游草稿 → releaseByTarget(删台账,序号回收)。释放痕迹另由 form_flow_link 的 RELEASED 行保留。
 */
@Service
public class BatchService {

    /** 系统参数键:收料超送比例 */
    public static final String KEY_OVER_RATIO = "receive_over_ratio";

    private final JdbcTemplate jdbc;

    /** 超送比例缓存(30 秒,与 PanelRegistry TTL 同量级,避免每次生单查库) */
    private volatile double ratioCache = 0d;
    private volatile long ratioAt = 0L;

    public BatchService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==================== 参数 ====================

    /** 收料超送比例(0~1;参数缺失或非法按 0 处理) */
    public double overRatio() {
        long now = System.currentTimeMillis();
        if (now - ratioAt < 30_000) return ratioCache;
        double v = 0d;
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT setting_value FROM yj_app_setting WHERE setting_key = ?", String.class, KEY_OVER_RATIO);
            if (!rows.isEmpty() && rows.get(0) != null) v = Double.parseDouble(rows.get(0).trim());
        } catch (Exception ignore) { /* 表未建等场景按 0 */ }
        if (v < 0 || v > 5) v = 0; // 兜底:负数/离谱值视为不允许超送
        ratioCache = v;
        ratioAt = now;
        return v;
    }

    // ==================== 取号与台账 ====================

    /** 批次号拼装:订单号(超长截断)-3 位序号 */
    public static String batchNo(String sourceFormNo, int seq) {
        String base = sourceFormNo == null ? "" : sourceFormNo.trim();
        if (base.length() > 40) base = base.substring(0, 40);
        return base + "-" + String.format("%03d", seq);
    }

    /** 预览下一个批次号(不占号,仅用于界面展示) */
    public String peekNextNo(String srcPanel, String srcNo) {
        return batchNo(srcNo, nextSeq(srcPanel, srcNo));
    }

    private int nextSeq(String srcPanel, String srcNo) {
        Set<Integer> used = new HashSet<>();
        try {
            // 只有 ACTIVE(有效)批次占号:释放后的批次行保留留痕但序号回到可用池(用户口径:批次号要回收)
            used.addAll(jdbc.queryForList("SELECT batch_seq FROM yj_doc_batch"
                    + " WHERE source_panel_code=? AND source_form_no=? AND status='ACTIVE'",
                    Integer.class, srcPanel, srcNo));
        } catch (Exception ignore) { /* 表未建 */ }
        int seq = 1;
        while (used.contains(seq)) seq++;
        return seq;
    }

    /** 取号占位(写台账,状态 ACTIVE,未绑定目标单);生成失败请调用 drop 回收序号 */
    @Transactional
    public String reserve(String srcPanel, String srcNo, String targetPanel, String user) {
        int seq = nextSeq(srcPanel, srcNo);
        String no = batchNo(srcNo, seq);
        jdbc.update("INSERT INTO yj_doc_batch (source_panel_code, source_form_no, batch_seq, batch_no, batch_qty, status,"
                        + " target_panel_code, create_by, create_time, remark)"
                        + " VALUES (?,?,?,?,0,'ACTIVE',?,?,SYSDATETIME(),N'分批送料占位')",
                srcPanel, srcNo, seq, no, targetPanel, user);
        return no;
    }

    /** 生成成功:绑定目标单据与本次送料数量合计(只更新本次 ACTIVE 占位行;历史 RELEASED 留痕行不动) */
    public void bind(String batchNo, String targetPanel, String targetFormNo, double qty) {
        jdbc.update("UPDATE yj_doc_batch SET target_panel_code=?, target_form_no=?, batch_qty=?, remark=N'分批送料'"
                + " WHERE batch_no=? AND status='ACTIVE' AND ISNULL(target_form_no,'')=''",
                targetPanel, targetFormNo, qty, batchNo);
    }

    /** 生单失败:删占位台账(序号回收;只删"未绑定目标单"的本轮 ACTIVE 占位行) */
    public void drop(String batchNo) {
        try {
            jdbc.update("DELETE FROM yj_doc_batch WHERE batch_no=? AND status='ACTIVE' AND ISNULL(target_form_no,'')=''",
                    batchNo);
        } catch (Exception ignore) { /* 不阻断主流程 */ }
    }

    /**
     * 释放批次(下游单作废/删除):状态置 RELEASED + 留痕,序号回到可用池。
     * 注意:不删台账行 —— 留痕用于审计;序号复用由 §nextSeq 只认 ACTIVE 实现(用户口径:批次号要回收)。
     */
    public void releaseByTarget(String targetPanel, String targetFormNo) {
        try {
            jdbc.update("UPDATE yj_doc_batch SET status='RELEASED', release_time=SYSDATETIME()"
                    + " WHERE target_panel_code=? AND target_form_no=? AND status='ACTIVE'", targetPanel, targetFormNo);
        } catch (Exception ignore) { /* 表未建等场景不阻断删除 */ }
    }

    /** 某来源单的批次清单(默认只列有效批次;含历史释放行见 includeReleased) */
    public List<Map<String, Object>> batches(String srcPanel, String srcNo) {
        return batches(srcPanel, srcNo, false);
    }

    /** 批次清单:activeOnly=true 只列 ACTIVE;false 连历史释放行一起列(反查/审计用) */
    public List<Map<String, Object>> batches(String srcPanel, String srcNo, boolean includeReleased) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            out = jdbc.queryForList("SELECT batch_no AS batchNo, batch_seq AS batchSeq, batch_qty AS batchQty,"
                    + " status, target_panel_code AS targetPanel, target_form_no AS targetFormNo,"
                    + " CONVERT(varchar(19), create_time, 120) AS createTime"
                    + " FROM yj_doc_batch WHERE source_panel_code=? AND source_form_no=?"
                    + (includeReleased ? "" : " AND status='ACTIVE'")
                    + " ORDER BY batch_seq, id", srcPanel, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }

    /** 反查:某批次号的台账行(取最近一次使用;序号回收后同号会有多条留痕行) */
    public Map<String, Object> batchOf(String batchNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 source_panel_code AS sourcePanel, source_form_no AS sourceFormNo, batch_seq AS batchSeq,"
                        + " batch_qty AS batchQty, status, target_panel_code AS targetPanel, target_form_no AS targetFormNo"
                        + " FROM yj_doc_batch WHERE batch_no=? ORDER BY id DESC", batchNo);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ==================== 行级数量统计 ====================

    /** 该来源单各来源行的**已送量**:form_flow_link.source_line_key → Σlinked_quantity(仅 ACTIVE) */
    public Map<String, Double> sentByLineKey(String srcPanel, String srcNo) {
        Map<String, Double> out = new LinkedHashMap<>();
        try {
            jdbc.query("SELECT source_line_key, SUM(COALESCE(linked_quantity,0)) FROM form_flow_link"
                            + " WHERE source_panel_code=? AND source_form_no=? AND link_status='ACTIVE'"
                            + " GROUP BY source_line_key",
                    rs -> { out.put(rs.getString(1), rs.getDouble(2)); }, srcPanel, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }

    /**
     * 退货回冲:采购订单行号 → 退货数量合计。
     * 只认**已审核且未作废**的暂收退回单(QC_RETURN):草稿退回还没定论,不应提前把额度放回去。
     * 兜底:退货行没写「采购订单行号」时按订单行号为空分组(不参与任何行,避免错回冲)。
     */
    public Map<String, Double> returnedByOrderLine(String srcNo) {
        Map<String, Double> out = new LinkedHashMap<>();
        try {
            jdbc.query("SELECT LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50)))) ln,"
                            + " SUM(COALESCE(TRY_CAST(d.退货数量 AS decimal(18,4)),0))"
                            + " FROM qc_return_detail d JOIN qc_return r ON r.单据编号 = d.单据编号"
                            + " WHERE r.采购订单号 = ? AND ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(d.asp_cancel,'N')<>'Y'"
                            + "   AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_RETURN'"
                            + "               AND s.doc_no = r.单据编号 AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y')"
                            + " GROUP BY LTRIM(RTRIM(CAST(d.采购订单行号 AS nvarchar(50))))",
                    rs -> {
                        String k = rs.getString(1);
                        if (k != null && !k.isBlank()) out.put(k, rs.getDouble(2));
                    }, srcNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }

    /** 该批次号涉及的下游单据(form_flow_link,含已释放) —— 按批次反查用 */
    public List<Map<String, Object>> linksOfBatch(String batchNo) {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            out = jdbc.queryForList("SELECT DISTINCT source_panel_code AS sourcePanel, source_form_no AS sourceFormNo,"
                    + " target_panel_code AS targetPanel, target_form_no AS targetFormNo, link_status AS linkStatus"
                    + " FROM form_flow_link WHERE batch_no=?", batchNo);
        } catch (Exception ignore) { /* 表未建 */ }
        return out;
    }
}
