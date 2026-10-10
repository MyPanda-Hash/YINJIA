package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
 * 审核与弃审同一重算 → 对称幂等。
 *
 * <p><b>行标识 = 工单号 + 工单行号</b>(用户口径 2026-10-15「工单号+工单行号确定当前唯一工单,
 * 各个工单的进程、流程追溯都这样实现,都需要这两个进行确定」):
 * <ul><li>入库数量 {@code rk_sl} = **归属本行号**的已审入库单实收合计(2026-10-15 改;
 *     原来把整单入库总额 FIFO 摊到各批次行 ⇒ 同单多行之间入库量互相串);
 *     行号空/0 的老单仍按 FIFO 分摊(旧行为,只是不再整单一把摊);</li>
 * <li>领料单号 {@code ll_no2} 按行回写(2026-10-09);无行号老单按工单级兜底写全部行;</li>
 * <li>入库单号/完工日期(cp_date2 首次入库当日,不因冲回清空)按行写;scjl.post_no 回填该工单报工行。</li></ul>
 * 锚点:bd_finish_in/bd_material_out.加工单号 + **工单行号**(选单/切炭双出口均写入)。
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
     * 完工入库回填(**按工单行**,2026-10-15 用户口径「工单号+工单行号确定当前唯一工单」)。
     *
     * <p>行标识 = **工单号 + 工单行号**({@code bd_finish_in.工单行号} = {@code plang.pl_xc})。
     * 该行 rk_sl = **归属本行号**的已审核 FINISH_IN 实收合计;行号空/0 的老单(粒度修正前生成的)
     * 仍按 **FIFO 分摊**(先补前批至排产量、余量进后批)—— 与旧行为一致,只是不再"整单一把摊"。
     * rk_no 写该行的入库单号(没有专属单时退回全部单号);cp_date2 = 首次入库当日(仅空时写);
     * scjl.post_no 回填该工单未回写的报工行(参考库完工即入库口径)。
     */
    private void refreshReceipt(String contract, String user) {
        // 已审核且未作废的入库单:单号 + 工单行号 + 本单实收合计
        List<Map<String, Object>> docs = jdbc.queryForList(
                "SELECT TOP 50 h.[单据编号] AS no, ISNULL(h.[工单行号], 0) AS xc,"
                        + " ISNULL((SELECT SUM(l.实收数量) FROM bl_finish_in l"
                        + "   WHERE l.单据编号 = h.单据编号 AND ISNULL(l.asp_cancel,'N') <> 'Y'), 0) AS qty"
                        + " FROM bd_finish_in h"
                        + " JOIN yj_doc_status s ON s.panel_code = 'FINISH_IN' AND s.doc_no = h.[单据编号]"
                        + " WHERE h.[加工单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                        + " AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y'"
                        + " ORDER BY h.[单据编号] DESC", contract);
        Map<Integer, Double> qtyByXc = new LinkedHashMap<>();      // 工单行号 -> 该行已审入库合计
        Map<Integer, List<String>> noByXc = new LinkedHashMap<>(); // 工单行号 -> 该行入库单号
        List<String> allNos = new ArrayList<>();
        double legacyQty = 0;                                       // 行号空的老单合计(FIFO 兜底)
        for (Map<String, Object> d : docs) {
            String no = String.valueOf(d.get("no"));
            int xc = (int) numOr(d.get("xc"));
            allNos.add(no);
            if (xc == 0) { legacyQty += numOr(d.get("qty")); continue; }
            qtyByXc.merge(xc, numOr(d.get("qty")), Double::sum);
            noByXc.computeIfAbsent(xc, k -> new ArrayList<>()).add(no);
        }
        String allNoList = String.join(",", allNos);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, ISNULL(pl_xc,0) AS xc, ISNULL(pl_sl,0) AS pl_sl FROM dbo.plang"
                        + " WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY pl_xc, [批次号]", contract);
        double cumCap = 0;   // 老单 FIFO:前批排产累计
        for (Map<String, Object> row : rows) {
            int xc = (int) numOr(row.get("xc"));
            double cap = numOr(row.get("pl_sl"));
            // 老单(FIFO)份额:按排产量顺序分摊,只补到本批排产
            double legacyShare = Math.max(0, Math.min(legacyQty - cumCap, cap));
            cumCap += cap;
            // 本行入库 = 归属本行的入库(精确) + 老单 FIFO 份额
            double rk = qtyByXc.getOrDefault(xc, 0d) + legacyShare;
            List<String> own = noByXc.get(xc);
            String noList = (own == null || own.isEmpty()) ? allNoList : String.join(",", own);
            jdbc.update("UPDATE dbo.plang SET rk_sl = ?, yl = ISNULL(xq_sl,0) - ISNULL(pl_sl,0), rk_no = ?,"
                            + " cp_date2 = COALESCE(cp_date2, CASE WHEN ? > 0 THEN CAST(GETDATE() AS date) END),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                    rk, noList.isEmpty() ? null : noList, rk, user, row.get("id"));
        }
        // scjl.post_no 重算式回写(参考库完工即入库口径;对称:弃审入库单后随之清空,与 rk_no 同算)
        jdbc.update("UPDATE dbo.scjl SET post_no = ? WHERE gldh = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                allNos.isEmpty() ? null : allNos.get(0), contract);
    }

    /**
     * 生产领料回填(**按工单行**,2026-10-09 随「转领料单」粒度修正):
     * 行标识 = **工单号 + 工单行号**(用户口径 2026-10-15:「工单号加工单行号作为标识,每个独立进行」)。
     * 领料单头带 工单行号(= plang.pl_xc)⇒ 该行号的领料单号只写**该行号**的 ll_no2(工单列表逐行点亮);
     * 工单行号 空/0 的老单(手工建的 / 粒度修正前生成的)按**工单级**兜底写该单全部行 —— 旧行为不变。
     * 重算式:某行没有任何已审核领料单 → 清空(弃审对称回收);每行各取最近 3 张。
     */
    private void refreshPickList(String contract, String user) {
        List<Map<String, Object>> docs = jdbc.queryForList(
                "SELECT TOP 50 h.[单据编号] AS no, ISNULL(h.[工单行号], 0) AS xc FROM bd_material_out h"
                        + " JOIN yj_doc_status s ON s.panel_code = 'MATERIAL_OUT' AND s.doc_no = h.[单据编号]"
                        + " WHERE h.[加工单号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                        + " AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y'"
                        + " ORDER BY h.[单据编号] DESC", contract);
        Map<Integer, List<String>> byXc = new LinkedHashMap<>();   // 工单行号 -> 该行最近 3 张单号
        List<String> general = new ArrayList<>();                  // 工单级(无行号)老单
        for (Map<String, Object> d : docs) {
            String no = String.valueOf(d.get("no"));
            int xc = (int) numOr(d.get("xc"));
            if (xc == 0) {
                if (general.size() < 3) general.add(no);
                continue;
            }
            List<String> l = byXc.computeIfAbsent(xc, k -> new ArrayList<>());
            if (l.size() < 3) l.add(no);
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, ISNULL(pl_xc, 0) AS xc FROM dbo.plang WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                contract);
        for (Map<String, Object> row : rows) {
            List<String> nos = byXc.get((int) numOr(row.get("xc")));
            if (nos == null || nos.isEmpty()) nos = general;   // 该行没有专属领料单 ⇒ 工单级老单兜底
            String noList = String.join(",", nos);
            jdbc.update("UPDATE dbo.plang SET ll_no2 = ?, asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                    noList.isEmpty() ? null : noList, user, row.get("id"));
        }
    }

    private static double numOr(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }
}
