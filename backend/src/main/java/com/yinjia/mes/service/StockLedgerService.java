package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 库存台账记账(kucun):单据审核过账,弃审对称冲回。
 * 台账粒度 = (物料编码 wzdm, 仓库编码 ckdm, 批号 lot_no) 一行:rkl 累计入库 / ckl 累计出库 / yl 现存量。
 * 已接入面板:
 *   PURCHASE_IN 采购入库单(入库,+,行可无批号) — 材料入库链
 *   MATERIAL_OUT 材料出库单(出库,-,行必须扫码带批号,台账行必须已存在) — 生产过程层·扫码领料
 * 守卫:仓库档案必须存在(名称→bs_wh 编码);出库现存量不足拒绝;冲回为负拒绝;整笔回滚。
 */
@Service
public class StockLedgerService {

    private final JdbcTemplate jdbc;

    public StockLedgerService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 是否参与记账的面板。 */
    public static boolean postsStock(String panelCode) {
        return "PURCHASE_IN".equals(panelCode) || "MATERIAL_OUT".equals(panelCode)
                || "SALE_OUT".equals(panelCode) || "FINISH_IN".equals(panelCode);
    }

    /** 审核 → 过账(入库 + / 出库 −)。 */
    public void postIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        apply(panelCode, no, user, true);
    }

    /** 弃审 → 冲回。 */
    public void unpostIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        apply(panelCode, no, user, false);
    }

    private void apply(String panelCode, String no, String user, boolean forward) {
        boolean inbound = "PURCHASE_IN".equals(panelCode) || "FINISH_IN".equals(panelCode);
        List<Map<String, Object>> rows = loadRows(panelCode, no);
        if (rows.isEmpty()) throw new IllegalStateException(panelCode + " " + no + " 无明细行,不能记账");
        for (Map<String, Object> r : rows) {
            String code = str(r.get("code"));
            String lot = str(r.get("lot"));
            double qty = num(r.get("qty"));
            String whName = str(r.get("行仓库")) != null ? str(r.get("行仓库")) : str(r.get("头仓库"));
            Double price = r.get("price") == null ? null : num(r.get("price"));
            if (code == null) throw new IllegalStateException("存在缺少[材料/存货编码]的明细行,不能记账");
            if (qty == 0) continue; // 零行跳过;负数=红字冲回,正常过账(applyIn 内含负库存守卫)
            String ckdm = resolveCkdm(whName);
            if (ckdm == null) throw new IllegalStateException("仓库档案不存在:[" + whName + "],请先在基础档案-仓库中建立");
            if (inbound) applyIn(code, ckdm, lot, qty, price, user, forward);
            else applyOut(code, ckdm, lot, qty, user, forward);
        }
    }

    private void applyIn(String code, String ckdm, String lot, double qty, Double price, String user, boolean forward) {
        double sign = forward ? 1 : -1;
        int n = jdbc.update("UPDATE kucun SET rkl = rkl + ?, yl = yl + ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                sign * qty, sign * qty, user, code, ckdm, lot);
        if (n == 0) {
            if (!forward || qty < 0) throw new IllegalStateException("冲回失败:台账无该行(物料 " + code + " 批 " + lot + "),红字冲回要求台账行已存在");
            jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, ?, GETDATE(), ?, ?, ?, ?, GETDATE(), 'N')",
                    code, ckdm, lot, qty, qty, price, "stock:" + user);
            return;
        }
        if (!forward || qty < 0) {
            Double yl = bal(code, ckdm, lot);
            if (yl != null && yl < -0.0001) throw new IllegalStateException("冲回将使现存量为负(物料 " + code + " 批 " + lot + " 余额 " + yl + "),库存已被消耗,不可冲回");
        }
    }

    private void applyOut(String code, String ckdm, String lot, double qty, String user, boolean forward) {
        if (lot == null && forward) throw new IllegalStateException("出库行缺少[批号]——请扫材料二维码补批号后再审核(物料 " + code + ")");
        double sign = forward ? 1 : -1;
        int n = jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                sign * qty, sign * qty, user, code, ckdm, lot);
        if (n == 0) {
            if (forward) throw new IllegalStateException("台账无该批库存(物料 " + code + " 批 " + lot + " 仓 " + ckdm + "),不能出库");
            throw new IllegalStateException("冲回失败:台账无该行(物料 " + code + " 批 " + lot + ")");
        }
        Double yl = bal(code, ckdm, lot);
        if (yl != null && yl < -0.0001) {
            throw new IllegalStateException(forward
                    ? "现存量不足(物料 " + code + " 批 " + lot + " 出库后余额将变 " + yl + "),不能出库"
                    : "冲回将使现存量异常(物料 " + code + " 批 " + lot + " 余额 " + yl + "),不可弃审");
        }
    }

    private Double bal(String code, String ckdm, String lot) {
        List<Double> l = jdbc.queryForList("SELECT yl FROM kucun WHERE wzdm = ? AND ckdm = ? AND lot_no = ?", Double.class, code, ckdm, lot);
        return l.isEmpty() ? null : l.get(0);
    }

    private List<Map<String, Object>> loadRows(String panelCode, String no) {
        if ("PURCHASE_IN".equals(panelCode)) {
            return jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[实收数量] AS qty, l.[单价] AS price"
                            + " FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        }
        if ("SALE_OUT".equals(panelCode)) {
            // 销售出库(出货链):成品三键出库,行批号来自产品二维码
            return jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                            + " FROM bl_sale_out l LEFT JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        }
        if ("FINISH_IN".equals(panelCode)) {
            // 产成品入库(装箱后成品入仓):三键入库,批号来自产品二维码
            return jdbc.queryForList(
                    "SELECT l.[产品编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[实收数量] AS qty, l.[单价] AS price"
                            + " FROM bl_finish_in l LEFT JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        }
        return jdbc.queryForList(
                "SELECT l.[材料编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                        + " FROM bl_material_out l LEFT JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
    }

    /** 仓库名称 → 编码(bs_wh)。 */
    private String resolveCkdm(String whName) {
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
