package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 生产加工单执行回填(参考库 plang_pc 口径,盘点文档 §4.5 标注的最大缺口)。
 *
 * <p>参考库标准(docs/design/参考库生产管理盘点-表结构与逻辑实现.md §1.2/§3.1.4):
 * <ul><li>完工即入库:inh(bz1='生产入库') 审核后回写工单 rk_sl 入库数量 + rk_no 入库单号(实测 RK2608260004);</li>
 * <li>生产领料:outh(bz1='生产领料') 审核后回写工单 ll_no2 领料单号(实测 LL2608260002)。</li></ul>
 *
 * <p>实现口径:**重算式回填**——每次以"该工单名下全部已审核且未作废的入库/领料单"为真源重算,
 * 审核与弃审走同一重算 → 天然对称、幂等,不存在 +/− 漂移;余量=排产数量−入库数量 同步重算;
 * 完工日期仅在首次有入库且为空时落当日(不因冲回清空,保留人工可改语义)。
 *
 * <p>锚点:bd_finish_in/bd_material_out.加工单号(选单与 WoPickingHandler/切炭双出口均写入);
 * 切炭双出口自动入库经 audit() 同路径,本回写随之生效。OUTSOURCE_ORDER 头表无工单锚点,
 * 外包单号 wb_no 暂无回写落点(盘点文档 §4.1 已注)。
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
     * 完工入库回填:入库数量=Σ已审核 FINISH_IN 行.实收数量;入库单号=最近已审核单号(最多 3 张,逗号隔);
     * 余量=排产数量−入库数量;完工日期=首笔入库当日(仅空时写)。
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
        jdbc.update("UPDATE bd_manu_order SET 入库数量 = ?, 余量 = ISNULL(排产数量,0) - ?, 入库单号 = ?,"
                        + " 完工日期 = COALESCE(完工日期, CASE WHEN ? > 0 THEN CAST(GETDATE() AS date) END),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE 合同号 = ?",
                qty, qty, noList.isEmpty() ? null : noList, qty, user, contract);
    }

    /** 生产领料回填:领料单号=最近已审核 MATERIAL_OUT 单号(最多 3 张,逗号隔) */
    private void refreshPickList(String contract, String user) {
        List<Map<String, Object>> docs = auditedDocs("MATERIAL_OUT", "bd_material_out", contract);
        List<String> nos = new ArrayList<>();
        for (Map<String, Object> d : docs) nos.add(String.valueOf(d.get("no")));
        String noList = String.join(",", nos);
        jdbc.update("UPDATE bd_manu_order SET 领料单号 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE 合同号 = ?",
                noList.isEmpty() ? null : noList, user, contract);
    }

    /** 该工单名下已审核(yj_doc_status.shr 非空)且未作废/未软删的单据,按单号倒序取前 3 */
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
