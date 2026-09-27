package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 生产工单执行回填(2026-09-27 切 plang + scjl,参考库原始口径)。
 *
 * <p>参考库标准(docs/design/参考库生产管理盘点-表结构与逻辑实现.md §1.2/§3.1-3.2):
 * <ul><li>完工即入库:inh(bz1='生产入库') 审核后回写工单 rk_sl 入库数量 + rk_no 入库单号,
 *     并回写 **scjl.post_no**(实测 RK2608260004);</li>
 * <li>生产领料:outh(bz1='生产领料') 审核后回写工单 ll_no2 领料单号(实测 LL2608260002)。</li></ul>
 *
 * <p>实现口径:**重算式回填**——以"该工单名下全部已审核且未作废的入库/领料单"为真源重算,
 * 审核与弃审同一重算 → 对称幂等。工单=plang(可能多批次行):入库数量按 **FIFO 分配到各批次行**
 * (订单行号→批次,先补前批至排产量,余量进后批),行级 rk_sl/余量(=排产−入库)同步重算;
 * 入库单号/完工日期(cp_date2 首次入库当日,不因冲回清空)写全部行;
 * scjl.post_no 回填该工单未回写的报工行。
 * 锚点:bd_finish_in/bd_material_out.加工单号(选单/切炭双出口均写入)。
 */
@Service
public class ManuWritebackService {

    private final JdbcTemplate jdbc;

    public ManuWritebackService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 审核 hook:入库/领料单审核后重算对应工单回填列 */
    public void post(String panelCode, String docNo, String user) {
        refresh(panelCode, docNo, user);
    }

    /** 弃审 hook:同一重算(该单退出已审核集合,数量/单号随之回收) */
    public void unpost(String panelCode, String docNo, String user) {
        refresh(panelCode, docNo, user);
    }

    private void refresh(String panelCode, String docNo, String user) {
        if (!"FINISH_IN".equals(panelCode) && !"MATERIAL_OUT".equals(panelCode)) return;
        String contract = contractOf(panelCode, docNo);
        if (contract == null || contract.isBlank()) return;   // 未挂工单的普通入库/出库不回填
        if ("FINISH_IN".equals(panelCode)) refreshReceipt(contract, user);
        else refreshPickList(contract, user);
    }

    /** 单据头上的加工单号 */
    private String contractOf(String panelCode, String docNo) {
        String tbl = "FINISH_IN".equals(panelCode) ? "bd_finish_in" : "bd_material_out";
        List<String> r = jdbc.query("SELECT 加工单号 FROM " + tbl + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                (rs, i) -> rs.getString(1), docNo);
        return r.isEmpty() ? null : r.get(0);
    }

    /**
     * 完工入库回填(plang FIFO):入库总量=Σ已审核 FINISH_IN 行.实收数量;
     * 各批次行 rk_sl = clamp(总量−前批排产累计, 0, 本批排产);余量=排产−入库(行级);
     * 入库单号=最近已审核单号(最多 3 张)写全部行;完工日期 cp_date2=首笔入库当日(仅空时写);
     * scjl.post_no=入库单号 回填该工单未回写的报工行(参考库完工即入库口径)。
     */
    private void refreshReceipt(String contract, String user) {
        List<Map<String, Object>> docs = auditedDocs("FINISH_IN", "bd_finish_in", contract);
        double qty = 0;
        List<String> nos = new ArrayList<>();
        for (Map<String, Object> d : docs) {
            qty += numOr(d.get("qty"));
            nos.add(String.valueOf(d.get("no")));
        }
        String noList = String.join(",", nos);   // auditedDocs 已按单号倒序,取到即最近在前
        // FIFO 分配到 plang 各批次行(订单行号→批次)
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, ISNULL(pl_sl,0) AS pl_sl FROM dbo.plang"
                        + " WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY pl_xc, [批次号]", contract);
        double cumCap = 0;   // 前批排产累计
        for (Map<String, Object> row : rows) {
            double cap = numOr(row.get("pl_sl"));
            double rk = Math.max(0, Math.min(qty - cumCap, cap));
            cumCap += cap;
            jdbc.update("UPDATE dbo.plang SET rk_sl = ?, yl = ISNULL(pl_sl,0) - ?, rk_no = ?,"
                            + " cp_date2 = COALESCE(cp_date2, CASE WHEN ? > 0 THEN CAST(GETDATE() AS date) END),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                    rk, rk, noList.isEmpty() ? null : noList, rk, user, row.get("id"));
        }
        // scjl.post_no 重算式回写(参考库完工即入库口径;对称:弃审入库单后随之清空,与 rk_no 同算)
        jdbc.update("UPDATE dbo.scjl SET post_no = ? WHERE gldh = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                noList.isEmpty() ? null : nos.get(0), contract);
    }

    /** 生产领料回填:领料单号=最近已审核 MATERIAL_OUT 单号(最多 3 张)写 plang 全部行 */
    private void refreshPickList(String contract, String user) {
        List<Map<String, Object>> docs = auditedDocs("MATERIAL_OUT", "bd_material_out", contract);
        List<String> nos = new ArrayList<>();
        for (Map<String, Object> d : docs) nos.add(String.valueOf(d.get("no")));
        String noList = String.join(",", nos);
        jdbc.update("UPDATE dbo.plang SET ll_no2 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE pl_no = ?",
                noList.isEmpty() ? null : noList, user, contract);
    }

    /** 该工单名下已审核(yj_doc_status.shr 非空)且未作废/软删的单据,按单号倒序取前 3 */
    private List<Map<String, Object>> auditedDocs(String panelCode, String headTable, String contract) {
        String qtyCol = "FINISH_IN".equals(panelCode) ? "实收数量" : "数量";
        String lineTable = "FINISH_IN".equals(panelCode) ? "bl_finish_in" : "bl_material_out";
        String sql = "SELECT TOP 3 h.单据编号 AS no, ISNULL((SELECT SUM(l." + qtyCol + ") FROM " + lineTable
                + " l WHERE l.单据编号 = h.单据编号 AND ISNULL(l.asp_cancel,'N') <> 'Y'), 0) AS qty"
                + " FROM " + headTable + " h"
                + " JOIN yj_doc_status s ON s.panel_code = '" + panelCode + "' AND s.doc_no = h.单据编号"
                + " WHERE h.加工单号 = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                + " AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y'"
                + " ORDER BY h.单据编号 DESC";
        return jdbc.queryForList(sql, contract);
    }

    private static double numOr(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }
}
