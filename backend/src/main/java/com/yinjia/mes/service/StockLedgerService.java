package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 库存台账记账(kucun):单据审核 → 入库量/结余入账;弃审 → 对称冲回。
 * 一期挂采购入库单(PURCHASE_IN,材料入库链);出库/产成品入库随各自层接入同一服务。
 * 台账粒度 = (物料编码 wzdm, 仓库编码 ckdm, 批号 lot_no) 一行,rkl 累计入库 / yl 现存量;
 * 仓库以名称入单(bs_wh.仓库名称),记账时解析为编码(仓库档案必须先建)。
 * 弃审冲回若导致现存量为负(库存已被下游消耗)则拒绝,整笔回滚。
 */
@Service
public class StockLedgerService {

    private final JdbcTemplate jdbc;

    public StockLedgerService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 是否参与记账的面板(入库类)。 */
    public static boolean postsStock(String panelCode) {
        return "PURCHASE_IN".equals(panelCode);
    }

    /** 审核 → 记账(+qty)。 */
    public void postIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT l.[存货编码], l.[仓库] AS 行仓库, h.[仓库] AS 头仓库, l.[批号], l.[实收数量], l.[单价]"
                        + " FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        if (rows.isEmpty()) throw new IllegalStateException("采购入库单无明细行,不能记账");
        for (Map<String, Object> r : rows) {
            postOne(
                    str(r.get("存货编码")),
                    str(r.get("行仓库")) != null ? str(r.get("行仓库")) : str(r.get("头仓库")),
                    str(r.get("批号")),
                    num(r.get("实收数量")),
                    num(r.get("单价")),
                    user);
        }
    }

    /** 弃审 → 冲回(-qty;现存量不足则抛错回滚)。 */
    public void unpostIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT l.[存货编码], l.[仓库] AS 行仓库, h.[仓库] AS 头仓库, l.[批号], l.[实收数量]"
                        + " FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        for (Map<String, Object> r : rows) {
            String wzdm = str(r.get("存货编码"));
            String ckdm = resolveCkdm(str(r.get("行仓库")) != null ? str(r.get("行仓库")) : str(r.get("头仓库")));
            String lot = str(r.get("批号"));
            double qty = num(r.get("实收数量"));
            int n = jdbc.update("UPDATE kucun SET rkl = rkl - ?, yl = yl - ?, update_date = GETDATE(),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                    qty, qty, user, wzdm, ckdm, lot);
            if (n == 0) throw new IllegalStateException("弃审冲回失败:台账无该行(物料 " + wzdm + " 批 " + lot + "),可能已被清理");
            Double yl = jdbc.queryForObject("SELECT yl FROM kucun WHERE wzdm = ? AND ckdm = ? AND lot_no = ?", Double.class, wzdm, ckdm, lot);
            if (yl != null && yl < -0.0001) {
                throw new IllegalStateException("弃审冲回将使现存量为负(物料 " + wzdm + " 批 " + lot + " 余额 " + yl + "),库存已被消耗,不可弃审");
            }
        }
    }

    private void postOne(String wzdm, String whName, String lot, double qty, Double price, String user) {
        if (wzdm == null || wzdm.isBlank()) throw new IllegalStateException("入库行缺少[存货编码],不能记账(请从品检链生单或补填)");
        if (qty <= 0) return; // 零数量行跳过
        String ckdm = resolveCkdm(whName);
        if (ckdm == null) throw new IllegalStateException("仓库档案不存在:[" + whName + "],请先在基础档案-仓库中建立");
        int n = jdbc.update("UPDATE kucun SET rkl = rkl + ?, yl = yl + ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ? AND lot_no = ?",
                qty, qty, user, wzdm, ckdm, lot);
        if (n == 0) {
            jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, ?, GETDATE(), ?, ?, ?, ?, GETDATE(), 'N')",
                    wzdm, ckdm, lot, qty, qty, price, "stock:" + user);
        }
    }

    /** 仓库名称 → 编码(bs_wh)。 */
    private String resolveCkdm(String whName) {
        if (whName == null || whName.isBlank()) return null;
        List<String> codes = jdbc.queryForList(
                "SELECT [仓库编码] FROM bs_wh WHERE [仓库名称] = ? AND ISNULL([状态], N'启用') = N'启用'", String.class, whName);
        return codes.isEmpty() ? null : codes.get(0);
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
