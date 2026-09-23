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
        return switch (panelCode) {
            case "PURCHASE_IN", "FINISH_IN", "OTHER_IN", "OUTSOURCE_IN",
                 "MATERIAL_OUT", "SALE_OUT", "OTHER_OUT", "OUTSOURCE_ISSUE" -> true;
            default -> false;
        };
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
        boolean inbound = switch (panelCode) {
            case "PURCHASE_IN", "FINISH_IN", "OTHER_IN", "OUTSOURCE_IN" -> true;
            default -> false; // MATERIAL_OUT, SALE_OUT, OTHER_OUT, OUTSOURCE_ISSUE
        };
        List<Map<String, Object>> rows = loadRows(panelCode, no);
        // 弃审时无明细行或仓库缺失 → 跳过台账冲回(不阻断弃审;正常审核过的必有行和仓库)
        // 2026-09-23:仓库三列(仓库/仓库名称/仓库编码)全为空才算"缺失"
        if (!forward && (rows.isEmpty() || rows.stream().allMatch(r ->
                str(r.get("行仓库")) == null && str(r.get("头仓库")) == null
                        && str(r.get("行仓库名称")) == null && str(r.get("行仓库编码")) == null
                        && str(r.get("头仓库编码")) == null))) {
            return;
        }
        if (rows.isEmpty()) throw new IllegalStateException(panelCode + " " + no + " 无明细行,不能记账");
        for (Map<String, Object> r : rows) {
            String code = str(r.get("code"));
            String lot = str(r.get("lot"));
            // 冲回兜底(2026-09-22):采购入库的批号取值改为「批次号优先、批号兜底」后,
            // 历史单据可能按旧口径(批号/NULL)记的账 —— 主批号冲不回时按备选批号再冲一次
            // (备选**存在但为空**也算:按 NULL 安全匹配冲旧的无批号行),
            // 避免"账在、批号口径变了、冲回静默跳过"的库存虚挂。
            boolean hasAlt = r.containsKey("lotAlt");           // 只有采购链的查询带 lotAlt 键
            String lotAlt = str(r.get("lotAlt"));
            double qty = num(r.get("qty"));
            // 仓库(2026-09-23):**编码优先、名称兜底** —— 采购入库/销售出库的明细仓库由
            // 「参照选仓库」写进 仓库名称+仓库编码 两列(界面必填的是 仓库名称),旧列 [仓库]
            // 可能为空;只认 [仓库] 会抛「仓库档案不存在:[null]」导致审核不过
            // (用户报的采购入库单 PI-2026-09-0128 即此:行上 仓库名称=华北工控仓、仓库编码=CK00006、仓库=NULL)
            String whCode = firstNonBlank(str(r.get("行仓库编码")), str(r.get("头仓库编码")));
            String whName = firstNonBlank(str(r.get("行仓库")), str(r.get("行仓库名称")), str(r.get("头仓库")));
            Double price = r.get("price") == null ? null : num(r.get("price"));
            if (code == null) throw new IllegalStateException("存在缺少[材料/存货编码]的明细行,不能记账");
            if (qty == 0) continue; // 零行跳过;负数=红字冲回,正常过账(applyIn 内含负库存守卫)
            // 弃审时该行仓库为空 → 跳过该行(审核时可能没填仓库就没过账)
            if (!forward && whName == null && whCode == null) continue;
            String ckdm = resolveWh(whCode, whName);
            if (ckdm == null) throw new IllegalStateException(
                    "仓库档案不存在:[" + (whName != null ? whName : whCode) + "],请先在基础档案-仓库中建立");
            if (inbound) {
                int n = applyIn(code, ckdm, lot, qty, price, user, forward);
                boolean altDiffers = lotAlt == null || lotAlt.isEmpty() || !lotAlt.equals(lot);
                if (n == 0 && !forward && hasAlt && altDiffers) {
                    applyIn(code, ckdm, lotAlt == null || lotAlt.isEmpty() ? null : lotAlt, qty, price, user, forward);
                }
            } else {
                applyOut(code, ckdm, lot, qty, user, forward);
            }
        }
    }

    /** @return 冲回时命中的台账行数(0=没冲到,供备选批号兜底);过账(前进)时无意义 */
    private int applyIn(String code, String ckdm, String lot, double qty, Double price, String user, boolean forward) {
        double sign = forward ? 1 : -1;
        // lot 为 NULL 时 =(null) 永不匹配:无批号入库行(如来料检验单生成的采购入库单)会插入
        // lot_no=NULL 台账行,弃审却永远匹配不到 → "台账无该行"死锁;改为 NULL 安全匹配
        int n = jdbc.update("UPDATE kucun SET rkl = rkl + ?, yl = yl + ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ?"
                        + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)",
                sign * qty, sign * qty, user, code, ckdm, lot, lot);
        if (n == 0) {
            if (!forward || qty < 0) {
                // 同步脚本设的已审核单据跳过了正常审核流程(未写台账),弃审时台账无行 → 跳过冲回
                // 正常 UI 审核过的单据台账必有行,不会走这个分支
                return 0;
            }
            jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, ?, GETDATE(), ?, ?, ?, ?, GETDATE(), 'N')",
                    code, ckdm, lot, qty, qty, price, "stock:" + user);
            return 0;
        }
        if (!forward || qty < 0) {
            Double yl = bal(code, ckdm, lot);
            if (yl != null && yl < -0.0001) throw new IllegalStateException("冲回将使现存量为负(物料 " + code + " 批 " + lot + " 余额 " + yl + "),库存已被消耗,不可冲回");
        }
        return n;
    }

    private void applyOut(String code, String ckdm, String lot, double qty, String user, boolean forward) {
        if (lot == null && forward) throw new IllegalStateException("出库行缺少[批号]——请扫材料二维码补批号后再审核(物料 " + code + ")");
        double sign = forward ? 1 : -1;
        int n = jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ?"
                        + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)",
                sign * qty, sign * qty, user, code, ckdm, lot, lot);
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
        List<Double> l = jdbc.queryForList("SELECT yl FROM kucun WHERE wzdm = ? AND ckdm = ?"
                + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)", Double.class, code, ckdm, lot, lot);
        return l.isEmpty() ? null : l.get(0);
    }

    private List<Map<String, Object>> loadRows(String panelCode, String no) {
        // 仓库取值口径(2026-09-23):采购入库/销售出库的**明细仓库**由「参照选仓库」写入
        // `仓库名称`+`仓库编码` 两列(界面必填的是 仓库名称),旧列 `仓库` 可能为空 ——
        // 故这两张单的查询把三列一起取出,由 resolveWh 做「编码优先、名称兜底」解析;
        // 其余行表没有这两列(已核实),保持原样。
        return switch (panelCode) {
            case "PURCHASE_IN" -> jdbc.queryForList(
                    // 批号口径(2026-09-22):**批次号优先、(供应商)批号兜底** —— 采购链按「只用批次号」
                    // 口径标识批次(纯入库日期),且批次号在**入库审核时**才确认,故调用顺序必须
                    // 先确认批次号(ButtonService.assignBatchNoOnInbound)再过账,台账 lot_no 才有值。
                    // lotAlt=备选批号(旧值):冲回时主批号没冲到按它兜底(历史单据按旧口径记的账)。
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库],"
                            + " l.[仓库名称] AS [行仓库名称], l.[仓库编码] AS [行仓库编码], h.[仓库编码] AS [头仓库编码],"
                            + " ISNULL(NULLIF(l.[批次号], N''), l.[批号]) AS lot, l.[批号] AS lotAlt,"
                            + " l.[实收数量] AS qty, l.[单价] AS price"
                            + " FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "FINISH_IN" -> jdbc.queryForList(
                    "SELECT l.[产品编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[实收数量] AS qty, l.[单价] AS price"
                            + " FROM bl_finish_in l LEFT JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "OTHER_IN" -> jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, l.[单价] AS price"
                            + " FROM bl_other_in l LEFT JOIN bd_other_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "OUTSOURCE_IN" -> jdbc.queryForList(
                    // 行仓库优先,缺失时回退头仓库
                    "SELECT l.[产品编码] AS code, l.[仓库] AS [行仓库], ISNULL(l.[仓库], h.[仓库]) AS [头仓库], l.[批号] AS lot, l.[实收数量] AS qty, l.[单价] AS price"
                            + " FROM bl_outsource_in l LEFT JOIN bd_outsource_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "SALE_OUT" -> jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库],"
                            + " l.[仓库名称] AS [行仓库名称], l.[仓库编码] AS [行仓库编码],"
                            + " l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                            + " FROM bl_sale_out l LEFT JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "OTHER_OUT" -> jdbc.queryForList(
                    // 头表无仓库列,仓库取行表
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], l.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                            + " FROM bl_other_out l"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "OUTSOURCE_ISSUE" -> jdbc.queryForList(
                    "SELECT l.[材料编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                            + " FROM bl_outsource_issue l LEFT JOIN bd_outsource_issue h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            default -> jdbc.queryForList( // MATERIAL_OUT
                    "SELECT l.[材料编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price"
                            + " FROM bl_material_out l LEFT JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
        };
    }

    /** 仓库解析(2026-09-23):**编码优先、名称兜底**。
     *  为什么编码优先:编码是稳定标识(仓库改名不会断链),且采购入库/销售出库的明细仓库
     *  由参照录入写的是 `仓库编码`+`仓库名称`;编码必须在 bs_wh 里存在(启用)才采用,
     *  否则回退按名称解析。两者都取不到返回 null(调用方抛"仓库档案不存在")。 */
    private String resolveWh(String whCode, String whName) {
        if (whCode != null && !whCode.isBlank()) {
            List<String> hit = jdbc.queryForList(
                    "SELECT [仓库编码] FROM bs_wh WHERE [仓库编码] = ? AND ISNULL([状态], N'启用') = N'启用'",
                    String.class, whCode.trim());
            if (!hit.isEmpty()) return hit.get(0);
        }
        return resolveCkdm(whName);
    }

    /** 仓库名称 → 编码(bs_wh)。 */
    private String resolveCkdm(String whName) {
        if (whName == null || whName.isBlank()) return null;
        List<String> codes = jdbc.queryForList(
                "SELECT [仓库编码] FROM bs_wh WHERE [仓库名称] = ? AND ISNULL([状态], N'启用') = N'启用'", String.class, whName);
        return codes.isEmpty() ? null : codes.get(0);
    }

    /** 取第一个非空值(仓库三列兜底用) */
    private static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
