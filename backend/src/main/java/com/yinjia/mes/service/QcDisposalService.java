package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 不良品处理记账(品质层 #11):处理单审核 → kucun 原仓三键扣减(出库语义),
 * 处置=转隔离仓/转不良品仓 时同步在目标仓三键入库(移仓),报废则只扣不入。
 * 弃审对称冲回(移仓冲回要求目标仓未被消耗)。
 * 流程图依据: 品质的数据处理——设定隔离仓、不良品仓,所有有问题的先进入隔离仓再进一步判断。
 */
@Service
public class QcDisposalService {

    private final JdbcTemplate jdbc;

    public QcDisposalService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static boolean posts(String panelCode) {
        return "QC_DISPOSAL".equals(panelCode);
    }

    public void post(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        apply(no, user, true);
    }

    public void unpost(String panelCode, String no, String user) {
        if (!posts(panelCode)) return;
        apply(no, user, false);
    }

    private void apply(String no, String user, boolean forward) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT [物料编码], [批号], [数量], [原仓库], [处置方式] FROM qc_disposal"
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel, 'N') <> 'Y'", no);
        if (rows.isEmpty()) throw new IllegalStateException("不良品处理单无有效行,不能过账");
        for (Map<String, Object> r : rows) {
            String code = str(r.get("物料编码"));
            String lot = str(r.get("批号"));
            double qty = num(r.get("数量"));
            String srcWh = str(r.get("原仓库"));
            String mode = str(r.get("处置方式"));
            if (code == null || lot == null || qty <= 0) throw new IllegalStateException("处理单缺少物料编码/批号/数量,不能过账");
            String srcCk = ckdm(srcWh);
            if (srcCk == null) throw new IllegalStateException("原仓库档案不存在:[" + srcWh + "]");
            String dstCk = null;
            if ("转隔离仓".equals(mode)) dstCk = ckdm("隔离仓");
            else if ("转不良品仓".equals(mode)) dstCk = ckdm("不良品仓");
            else if (!"报废".equals(mode)) throw new IllegalStateException("未知处置方式:" + mode);
            if (mode != null && !mode.equals("报废") && dstCk == null) throw new IllegalStateException("目标仓库(隔离仓/不良品仓)未在基础档案建立");

            double sign = forward ? 1 : -1;
            // 原仓: 出库语义
            int n = jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                    sign * qty, sign * qty, user, code, srcCk, lot);
            if (n == 0) throw new IllegalStateException((forward ? "原仓台账无该批(物料 " : "冲回失败:原仓台账无该行(物料 ") + code + " 批 " + lot + ")");
            Double srcYl = bal(code, srcCk, lot);
            if (srcYl != null && srcYl < -0.0001) throw new IllegalStateException((forward ? "原仓现存量不足(余额将变 " : "冲回将使原仓余额异常(") + srcYl + "),物料 " + code);

            // 目标仓: 入库语义(移仓)
            if (dstCk != null) {
                int m = jdbc.update("UPDATE kucun SET rkl = rkl + ?, yl = yl + ?, update_date = GETDATE(),"
                                + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                        sign * qty, sign * qty, user, code, dstCk, lot);
                if (m == 0) {
                    if (!forward) throw new IllegalStateException("冲回失败:目标仓台账无该行(物料 " + code + " 批 " + lot + "),可能已被清理");
                    Double price = priceOf(code, srcCk, lot);
                    jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, bz, asp_user1, asp_time1, asp_cancel)"
                                    + " VALUES (?, ?, ?, GETDATE(), ?, ?, ?, N'不良品移仓', ?, GETDATE(), 'N')",
                            code, dstCk, lot, qty, qty, price, "qc:" + user);
                } else if (!forward) {
                    Double dstYl = bal(code, dstCk, lot);
                    if (dstYl != null && dstYl < -0.0001) throw new IllegalStateException("冲回将使目标仓余额异常(" + dstYl + "),目标仓库存可能已被消耗,不可弃审");
                }
            }
        }
    }

    private Double bal(String code, String ckdm, String lot) {
        List<Double> l = jdbc.queryForList("SELECT yl FROM kucun WHERE wzdm = ? AND ckdm = ? AND lot_no = ?", Double.class, code, ckdm, lot);
        return l.isEmpty() ? null : l.get(0);
    }

    private Double priceOf(String code, String ckdm, String lot) {
        List<Double> l = jdbc.queryForList("SELECT price FROM kucun WHERE wzdm = ? AND ckdm = ? AND lot_no = ?", Double.class, code, ckdm, lot);
        return l.isEmpty() || l.get(0) == null ? null : l.get(0);
    }

    private String ckdm(String whName) {
        if (whName == null || whName.isBlank()) return null;
        List<String> codes = jdbc.queryForList(
                "SELECT [仓库编码] FROM bs_wh WHERE [仓库名称] = ? AND ISNULL([状态], N'启用') = N'启用'", String.class, whName);
        return codes.isEmpty() ? null : codes.get(0);
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
