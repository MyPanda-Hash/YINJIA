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
 *
 * 2026-09-30(库存三表):除 kucun 结存之外,同一事务内还写**流水**(inh/outh,见 {@link StockFlowService}),
 * 流水为唯一真源、kucun 退为结存缓存 —— 两者必须同键同量,否则静态检查「结存 == Σ流水」会报差。
 */
@Service
public class StockLedgerService {

    private final JdbcTemplate jdbc;
    private final StockFlowService stockFlow;

    public StockLedgerService(JdbcTemplate jdbc, StockFlowService stockFlow) {
        this.jdbc = jdbc;
        this.stockFlow = stockFlow;
    }

    /**
     * 是否参与记账的面板。
     *
     * <p>2026-10-08:OTHER_IN / OUTSOURCE_IN / OTHER_OUT / OUTSOURCE_ISSUE 四张面板整体下架
     * (tools/migrate-drop-extra-docs-pu-req-20261008.sql),记账集合收敛为下面四张。
     */
    public static boolean postsStock(String panelCode) {
        return switch (panelCode) {
            case "PURCHASE_IN", "FINISH_IN", "MATERIAL_OUT", "SALE_OUT" -> true;
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
            case "PURCHASE_IN", "FINISH_IN" -> true;
            default -> false; // MATERIAL_OUT, SALE_OUT(2026-10-08 起出库只剩这两张)
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
            String ckdm = resolveWh(whCode, whName, r);
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
        // 2026-09-30:结存(kucun)之外**同事务写流水**(inh/outh) —— 流水为唯一真源,kucun 退为结存缓存。
        // 放在 kucun 之后:业务守卫(仓库档案存在/现存量不足)若抛错,流水不会先落库,整笔一起回滚。
        // 弃审的"无明细行/仓库三列全空 ⇒ 静默跳过冲回"在方法开头已 return ⇒ 流水同样不冲,两边口径一致。
        stockFlow.postFlow(panelCode, no, rows, forward, user);
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

    /**
     * 取单据明细行。返回的键除结存(kucun)要用的 code/lot/lotAlt/qty/price 与仓库三列之外,
     * **还带流水表(inh/outh)要用的键**:rid(来源行 id,幂等键的一半)、金额、name/spec/uom(物料名称/
     * 规格型号/计量单位)、单据类型、单据日期、往来单位、经手人、含税金额/税额 —— 取值口径逐列照抄
     * v_stock_movement(该视图是这几列的对外契约,任务 4 改它读流水后报表才不会漂)。
     * 仓库**不在这里解析**:流水要写的是 kucun 的同款档案编码,由 {@link #resolveWh} 解析后回填。
     *
     * 含税金额/税额(2026-10-03,任务 7):**只有采购入库 / 销售出库两段有值**,取值口径与旧视图
     * (tools/migrate-inv-report-fields.sql §1)逐字相同:
     *   · 采购入库:含税金额 = bl_purchase_in.含税金额;
     *              税额 = 含税金额 − ISNULL(金额, 单价×实收数量) —— **反推**(该表没有 税额 列);
     *   · 销售出库:含税金额 = bl_sale_out.含税销售金额(列名不同);税额 = bl_sale_out.税额;
     *   · 其余两段(材料出库/产成品入库的行表本身没有这两列)与期初:不取键 ⇒ 流水落 NULL(与旧视图同口径,不臆造)。
     *   · 2026-10-08:其他入库/其他出库/委外入库/委外发料四段随面板下架整体移除(原来共 8 段,现 4 段)。
     */
    private List<Map<String, Object>> loadRows(String panelCode, String no) {
        // 仓库取值口径(2026-09-23):采购入库/销售出库的**明细仓库**由「参照选仓库」写入
        // `仓库名称`+`仓库编码` 两列(界面必填的是 仓库名称),旧列 `仓库` 可能为空 ——
        // 故这两张单的查询把三列一起取出,由 resolveWh 做「编码优先、名称兜底」解析;
        // 其余行表没有这两列(已核实),保持原样。
        // 往来单位/经手人(2026-09-30):**照抄 v_stock_movement 的口径** —— 只有 1 采购入库(供应商)、
        // 5 销售出库(客户)两段有往来单位;材料出库段只有 领用人(语义不同,不取)。
        // 2026-10-08:调用方 postsStock 已把面板收敛为这四张,default 只是防御(返回空表,由 apply 抛「无明细行」)。
        return switch (panelCode) {
            case "PURCHASE_IN" -> jdbc.queryForList(
                    // 批号口径(2026-09-22):**批次号优先、(供应商)批号兜底** —— 采购链按「只用批次号」
                    // 口径标识批次(供应商编码去 YJ- 前缀 + - + 生单当天 yyyyMMdd)。
                    // 2026-10-04 口径:批次号在**生单那一刻**就写在单头+全部明细行(不再有入库审核取号回填),
                    // 故过账时行上必有值;审核钩子仍先跑 BatchService.syncBatchNo 做头行自洽兜底
                    // (手工新建/口径上线前的老单)。
                    // lotAlt=备选批号(旧值):冲回时主批号没冲到按它兜底(历史单据按旧口径记的账)。
                    // 2026-09-23 仓库正名:采购入库明细 仓库名称 已改名 仓库(migrate-wh-field-rename),
                    // 名称源回到标准形态 l.[仓库] AS 行仓库;头表 [仓库] 已删,头侧只剩 仓库编码 兜底。
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], l.[仓库编码] AS [行仓库编码], h.[仓库编码] AS [头仓库编码],"
                            + " ISNULL(NULLIF(l.[批次号], N''), l.[批号]) AS lot, l.[批号] AS lotAlt,"
                            + " l.[实收数量] AS qty, l.[单价] AS price,"
                            + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            + " ISNULL(l.[金额], l.[单价] * l.[实收数量]) AS 金额,"
                            // 含税金额/税额(2026-10-03 任务 7):口径照抄旧视图采购入库段 ——
                            // 该段 税额 是**反推**(bl_purchase_in 没有 税额 列,实测 sys.columns)
                            + " l.[含税金额] AS [含税金额],"
                            + " CAST(l.[含税金额] - ISNULL(l.[金额], l.[单价] * l.[实收数量]) AS decimal(18,4)) AS [税额],"
                            + " N'采购入库单' AS [单据类型], h.[单据日期] AS [单据日期], h.[供应商] AS [往来单位], h.[经手人] AS [经手人]"
                            + " FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            case "FINISH_IN" -> jdbc.queryForList(
                    "SELECT l.[产品编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[实收数量] AS qty, l.[单价] AS price,"
                            + " l.id AS rid, l.[产品名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            + " ISNULL(l.[金额], l.[单价] * l.[实收数量]) AS 金额,"
                            + " N'产成品入库单' AS [单据类型], h.[单据日期] AS [单据日期], NULL AS [往来单位], h.[经手人] AS [经手人]"
                            + " FROM bl_finish_in l LEFT JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            // 2026-10-08:原 OTHER_IN / OUTSOURCE_IN 两个入库段随面板下架整体移除
            case "SALE_OUT" -> jdbc.queryForList(
                    // 2026-09-30:**列名不许回退** —— 销售出库明细的仓库名称列早在 41a683aa
                    // (2026-09-23「仓库字段正名」)就已改名 仓库,采购分支当时同步改了、销售分支漏改,
                    // 于是本段一度引用不存在的 l.[仓库名称] ⇒ 销售出库单审核/弃审一律 500(error 207)。
                    // 名称源就是 l.[仓库](与其余出库段同形),不要再加 行仓库名称 —— apply 读它的两处
                    // (守卫的 null 判定、firstNonBlank 兜底)本就是 null 安全,多一列只会多一个改名断点。
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库],"
                            + " l.[仓库编码] AS [行仓库编码],"
                            + " l.[批号] AS lot, l.[数量] AS qty, NULL AS price,"
                            + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            + " ISNULL(l.[销售金额], l.[售价] * l.[数量]) AS 金额,"
                            // 含税金额/税额(2026-10-03 任务 7):口径照抄旧视图销售出库段 ——
                            // 该段的含税列名是 含税销售金额(不是 含税金额),税额是原样列
                            + " l.[含税销售金额] AS [含税金额], l.[税额] AS [税额],"
                            + " N'销售出库单' AS [单据类型], h.[单据日期] AS [单据日期], h.[客户] AS [往来单位], h.[经手人] AS [经手人]"
                            + " FROM bl_sale_out l LEFT JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            // 2026-10-08:原 OTHER_OUT / OUTSOURCE_ISSUE 两个出库段随面板下架整体移除
            case "MATERIAL_OUT" -> jdbc.queryForList(
                    "SELECT l.[材料编码] AS code, l.[仓库] AS [行仓库], h.[仓库] AS [头仓库], l.[批号] AS lot, l.[数量] AS qty, NULL AS price,"
                            + " l.id AS rid, l.[材料名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            + " ISNULL(l.[金额], l.[单价] * l.[数量]) AS 金额,"
                            + " N'材料出库单' AS [单据类型], h.[单据日期] AS [单据日期], NULL AS [往来单位], NULL AS [经手人]"
                            + " FROM bl_material_out l LEFT JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
            // 防御:postsStock 之外的面板不记账,给了也不该走到这里(真走到 → apply 会抛「无明细行」)
            default -> List.of();
        };
    }

    /** 仓库解析(2026-09-23):**编码优先、名称兜底**。
     *  为什么编码优先:编码是稳定标识(仓库改名不会断链),且采购入库/销售出库的明细仓库
     *  由参照录入写的是 `仓库编码`+`仓库名称`;编码必须在 bs_wh 里存在(启用)才采用,
     *  否则回退按名称解析。两者都取不到返回 null(调用方抛"仓库档案不存在")。
     *  2026-09-30:解析结果**回填到行上**(仓库编码/仓库名称),供流水表(inh/outh)写入 ——
     *  流水与 kucun 必须同键,而单据行上的仓库列只是解析输入(可能是别名、可能只有名称没编码)。 */
    private String resolveWh(String whCode, String whName, Map<String, Object> row) {
        if (whCode != null && !whCode.isBlank()) {
            List<Map<String, Object>> hit = jdbc.queryForList(
                    "SELECT [仓库编码] AS ckdm, [仓库名称] AS ckmc FROM bs_wh WHERE [仓库编码] = ? AND ISNULL([状态], N'启用') = N'启用'",
                    whCode.trim());
            if (!hit.isEmpty()) {
                row.put("仓库编码", firstNonBlank(str(hit.get(0).get("ckdm")), whCode.trim()));
                row.put("仓库名称", str(hit.get(0).get("ckmc")));
                return String.valueOf(row.get("仓库编码"));
            }
        }
        String byName = resolveCkdm(whName);
        if (byName != null) {
            row.put("仓库编码", byName);
            row.put("仓库名称", str(whName));
        }
        return byName;
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
