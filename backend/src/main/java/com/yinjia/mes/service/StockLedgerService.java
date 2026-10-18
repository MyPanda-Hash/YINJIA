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
     * 历史回填模式(2026-10-14):拉取的金蝶历史单据入库时,用 JVM 参数 {@code -Dmes.hist.backfill=true} 打开。
     *
     * <p>用户口径(2026-10-14):「无批号就先按无批号算,允许期初为负」。回填期间放开三处库存控制:
     * <ul>
     *   <li>出库行无批号 ⇒ 不再要求补批号,按无批号扣减(金蝶侧这批出库行本就没有批号);</li>
     *   <li>台账无该库存行 ⇒ 补一行 0 结存后继续(扣成负数由下一条容忍);</li>
     *   <li>出库后 / 冲回后余额为负 ⇒ 不再拒绝。</li>
     * </ul>
     * 为什么必须放开:回填的验收标准是「期初 + 记账 = 金蝶现存量」,而区间内存在非本仓拉取的
     * 库存移动(盘点/委外/调拨等),期间必然出现负结存 —— 终点对得上即可。
     * ⚠ 该开关**默认关闭**:日常录单/审核的库存控制一个字都没变。
     */
    private static final boolean HIST_BACKFILL = "true".equalsIgnoreCase(System.getProperty("mes.hist.backfill"));

    /**
     * 出库是否按批号核销(2026-10-19 用户口径:**否**)。
     *
     * <p><b>【上线前改写】</b>见 {@code docs/development/上线前必验-库存批次追溯.md}。
     * 用户 2026-10-19 拍板:「材料出库先不按批次号了」—— 验收期先不按批次追溯,
     * 保证无批次(金蝶默认占位 {@code PC0000})的货也能正常出库。
     *
     * <p>为什么必须这么改:金蝶对未启用批次管理的商品统一填默认批号 {@code PC0000},
     * 而 MES 采购入库按真实批号(如 {@code SX-20260901})记账 ⇒ 领料扣 {@code PC0000} 时那一行
     * 永远只出不进,kucun 里出现大量「按批号为负、按物料为正」的假负数
     * (实测 470 行负结存,按 (物料,仓库) 汇总后真缺货只有 2 组)。
     *
     * <p>切回按批号核销(正式上线当天):把本常量改成 {@code true} 即可,
     * 届时必须同时满足该文档 §五 的四条验收标准。
     */
    private static final boolean LOT_STRICT = false;

    /**
     * 是否参与记账的面板。
     *
     * <p>2026-10-08:OTHER_IN / OUTSOURCE_IN / OTHER_OUT / OUTSOURCE_ISSUE 四张面板整体下架
     * (tools/migrate-drop-extra-docs-pu-req-20261008.sql),记账集合收敛为四张。
     * <p>2026-10-14:**恢复 其他入库单 / 其他出库单 记账**(用户口径「要恢复库存记账」)——
     * 两面板已按金蝶字段重建(含行表 仓库/仓库编码/批号 与头表 部门/经手人),流水段号沿用既有口径
     * (3=其他入库 / 7=其他出库,见 StockFlowService)。委外两张复核后仍未使用,保持下架。
     * <p>2026-10-18:**新增调拨单 TRANSFER 与盘点单 STOCKTAKE**(用户口径「为我的库存核算写一个
     * 调拨单和盘点单,确保单据能正常使用和修改 kucun」)—— 两者记账形态与「单方向」出入库不同:
     * 调拨一条明细要动**两个仓库**、盘点要按**实盘差异**正负分方向,故不走 {@link #apply} 的
     * inbound/outbound 二分,而是各自 {@link #applyTransfer} / {@link #applyStocktake}。
     */
    public static boolean postsStock(String panelCode) {
        return switch (panelCode) {
            case "PURCHASE_IN", "FINISH_IN", "OTHER_IN", "MATERIAL_OUT", "SALE_OUT", "OTHER_OUT",
                 "TRANSFER", "STOCKTAKE" -> true;
            default -> false;
        };
    }

    /** 审核 → 过账(入库 + / 出库 −)。 */
    public void postIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        switch (panelCode) {
            case "TRANSFER" -> applyTransfer(no, user, true);
            case "STOCKTAKE" -> applyStocktake(no, user, true);
            default -> apply(panelCode, no, user, true);
        }
    }

    /** 弃审 → 冲回。 */
    public void unpostIn(String panelCode, String no, String user) {
        if (!postsStock(panelCode)) return;
        switch (panelCode) {
            case "TRANSFER" -> applyTransfer(no, user, false);
            case "STOCKTAKE" -> applyStocktake(no, user, false);
            default -> apply(panelCode, no, user, false);
        }
    }

    private void apply(String panelCode, String no, String user, boolean forward) {
        boolean inbound = switch (panelCode) {
            case "PURCHASE_IN", "FINISH_IN", "OTHER_IN" -> true; // 2026-10-14 恢复 其他入库
            default -> false; // MATERIAL_OUT, SALE_OUT, OTHER_OUT
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

    // ══════════════════════════ 调拨单(TRANSFER):一条明细两腿过账 ══════════════════════════

    /**
     * 调拨过账 / 冲回。
     *
     * <h3>口径</h3>
     * <ul>
     *   <li>一条明细 = **两条腿**:调出仓 {@link #applyOut} + 调入仓 {@link #applyIn},同物料、同批号、
     *       同数量、**同一事务**。任一条腿失败整笔回滚 ⇒ 不会出现"调出仓扣了、调入仓没进"的半截账;</li>
     *   <li>公司总库存不变,仓库间库存守恒 —— 这也是验收口径:调拨前后 Σ kucun.yl 必须逐字相等;</li>
     *   <li>弃审 = 两腿对称反做(出库腿加回、入库腿扣掉)。不按当时余额重算,直接用行上的数量,
     *       故"调拨后又发生了别的出入库"也不会冲错;</li>
     *   <li>不强制批号(见 {@link #applyOut(String,String,String,double,String,boolean,boolean)}):
     *       无批号的 kucun 行同样可以移库。</li>
     * </ul>
     *
     * <h3>为什么调出仓与调入仓不能相同</h3>
     * 同仓调拨在账上等于什么也没做,但会留下两条流水、两条成本记录 —— 纯噪声,且用户几乎总是选错。
     * 直接拒绝并提示,比"静默通过、事后在台账里发现两条对冲流水"好。
     */
    private void applyTransfer(String no, String user, boolean forward) {
        List<Map<String, Object>> rows = loadTransferRows(no);
        if (rows.isEmpty()) {
            if (forward) throw new IllegalStateException("调拨单 " + no + " 无明细行,不能记账");
            return;                                   // 弃审时无明细行 = 审核时也没记过账,直接放过
        }
        for (int idx = 0; idx < rows.size(); idx++) {
            Map<String, Object> r = rows.get(idx);
            int lineNo = idx + 1;
            String code = str(r.get("code"));
            String lot = str(r.get("lot"));
            double qty = num(r.get("qty"));
            if (code == null) throw new IllegalStateException("存在缺少[存货编码]的明细行,不能记账");
            // 零行:其余单据是"跳过"(历史上有红字冲回单留 0 行),但调拨单**没有数量就没有意义** ——
            // 选单带入后用户忘填数量是常见操作,静默跳过会让人以为"审核成功了却没动库存",故直接拒绝。
            if (qty == 0) {
                if (forward) throw new IllegalStateException("调拨单 " + no + " 存在[数量]为空或 0 的明细行(存货 "
                        + code + "),请填好数量再审核");
                continue;
            }
            String[] outWh = resolveWhPair(str(r.get("调出仓库编码")), str(r.get("调出仓库")));
            String[] inWh = resolveWhPair(str(r.get("调入仓库编码")), str(r.get("调入仓库")));
            if (outWh == null || inWh == null) {
                String miss = outWh == null ? str(r.get("调出仓库")) : str(r.get("调入仓库"));
                throw new IllegalStateException("仓库档案不存在:[" + (miss == null ? "空" : miss)
                        + "],请先在基础档案-仓库中建立");
            }
            String outCkdm = outWh[0], inCkdm = inWh[0];
            if (outCkdm.equalsIgnoreCase(inCkdm)) {
                throw new IllegalStateException("调拨单 " + no + " 存在「调出仓库 = 调入仓库」的明细行(均为 "
                        + outWh[1] + "),同仓调拨没有意义,请改成一个不同的调入仓库");
            }
            // 库位校验(2026-10-18):进/出两个仓位各自必须属于对应的仓库。只在**审核**时卡
            // (弃审是历史单回退,不该因为当年没填仓位而卡住)。
            if (forward) {
                ensureBinValid(no, lineNo, code, outWh[1], outCkdm, r.get("调出仓位"), "调出");
                ensureBinValid(no, lineNo, code, inWh[1], inCkdm, r.get("调入仓位"), "调入");
            }
            // 入库腿的单价:优先行上填的,其次调出仓该批次的结存单价(kucun.price),都没有按 0 ——
            // 为什么必须给个数:流水 inh.金额 若为 NULL,v_stock_movement 收入金额即 NULL,
            // 成本重算会 ISNULL(收入金额,0) 把这次移库当 0 元收入,调入仓的金额凭空蒸发。
            Double linePrice = priceOf(r.get("price"));
            Double inPrice = linePrice != null ? linePrice : kucunPrice(code, outCkdm, lot);
            if (inPrice == null) inPrice = 0d;
            r.put("调入单价", inPrice);
            r.put("调入金额", inPrice * qty);
            r.put("调出仓库编码", outCkdm);
            r.put("调出仓库", outWh[1]);
            r.put("调入仓库编码", inCkdm);
            r.put("调入仓库", inWh[1]);
            // 调出腿:出库(requireLot=false —— 调拨不是扫码领料,不强制批号)
            applyOut(code, outCkdm, lot, qty, user, forward, false);
            // 调入腿:入库。qty 为负时 applyIn 内部按红字处理(负数量 = 反向移库)
            applyIn(code, inCkdm, lot, qty, inPrice, user, forward);
        }
        // 两腿流水:调出仓 outh(src=10) + 调入仓 inh(src=9),同一 rid、不同 src ⇒ 幂等索引不冲突
        stockFlow.postTransferFlow(no, rows, forward, user);
    }

    // ══════════════════════════ 盘点单(STOCKTAKE):按实盘差异调平 ══════════════════════════

    /**
     * 盘点过账 / 冲回。
     *
     * <h3>审核(forward)</h3>
     * <ol>
     *   <li>逐行按 (物料, 仓库, 批号) 读 kucun 现值当「账面数量」;<b>实盘数量</b>为唯一人工输入;</li>
     *   <li>差异 = 实盘 − 账面。差异 &gt; 0 走入库(盘盈,inh src=11)、&lt; 0 走出库(盘亏,outh src=12);</li>
     *   <li>把 账面数量/差异数量 **回写到明细行留档** —— 界面这两列只读,值以审核时刻为准;</li>
     *   <li>结果是「盘点后该行库存 == 实盘数量」,与盘点前库存是多少无关(盘前刚好等于实盘则差异 0、不记流水)。</li>
     * </ol>
     *
     * <h3>弃审(backward)</h3>
     * 用行上**已留档的 差异数量** 对称反做,再清空这两列(它们是由审核派生的值,留着会让草稿显示过期数字)。
     * 不清的话,重审时会按新实盘重算并覆盖,但界面上"改单期间"看到的是上一次审核的结果,容易被误读。
     *
     * <h3>为什么不设预警闸门</h3>
     * 盘亏金额是"把账调到实盘"的必然结果,按定义不该被「低于预警数量」挡住 —— 否则盘点单永远审不了。
     * 现存量非负守卫仍在(applyOut 内含),所以不会盘成负库存。
     */
    private void applyStocktake(String no, String user, boolean forward) {
        List<Map<String, Object>> rows = loadStocktakeRows(no);
        if (rows.isEmpty()) {
            if (forward) throw new IllegalStateException("盘点单 " + no + " 无明细行,不能记账");
            return;
        }
        for (int idx = 0; idx < rows.size(); idx++) {
            Map<String, Object> r = rows.get(idx);
            int lineNo = idx + 1;
            String code = str(r.get("code"));
            String lot = str(r.get("lot"));
            Object rid = r.get("rid");
            if (code == null) throw new IllegalStateException("存在缺少[存货编码]的明细行,不能记账");
            String[] wh = resolveWhPair(str(r.get("行仓库编码")), str(r.get("行仓库")));
            if (wh == null) {
                throw new IllegalStateException("仓库档案不存在:[" + (str(r.get("行仓库")) == null ? "空" : str(r.get("行仓库")))
                        + "],请先在基础档案-仓库中建立");
            }
            String ckdm = wh[0];
            r.put("仓库编码", ckdm);
            r.put("仓库名称", wh[1]);
            // 库位校验(2026-10-18):该仓有仓位档案/已启用仓位管理 ⇒ 仓位必填;填了就必须属于本仓。
            // 只在审核时卡(弃审是历史单回退,不因当年没填仓位而卡住)。
            if (forward) ensureBinValid(no, lineNo, code, wh[1], ckdm, r.get("仓位"), "");
            // 单价:行上(只读,审核前为空) → 结存单价 → 0。理由同调拨(流水金额不能留 NULL)
            Double price = priceOf(r.get("price"));
            if (price == null) price = kucunPrice(code, ckdm, lot);
            if (price == null) price = 0d;
            r.put("price", price);

            double current;   // 账面数量
            double diff;      // 差异数量 = 实盘 − 账面
            if (forward) {
                Double actual = priceOf(r.get("实盘数量"));      // 复用:数值解析口径一致
                if (actual == null) {
                    throw new IllegalStateException("盘点单 " + no + " 存在未填[实盘数量]的明细行(存货 "
                            + code + "),不能审核");
                }
                Double bal = bal(code, ckdm, lot);
                current = bal == null ? 0d : bal;
                diff = actual - current;
                // 回写留档(界面只读列;弃审时按它反做,见方法头注)
                if (rid != null) {
                    jdbc.update("UPDATE bl_stocktake SET 账面数量 = ?, 差异数量 = ?, 金额 = ? WHERE id = ?",
                            java.math.BigDecimal.valueOf(current), java.math.BigDecimal.valueOf(diff),
                            java.math.BigDecimal.valueOf(price * actual), rid);
                }
                r.put("账面数量", current);
                r.put("差异数量", diff);
                r.put("金额", price * actual);
            } else {
                // 弃审:按留档的差异反做(此时行上 差异数量 就是审核时写进去的那个值)
                Double recorded = priceOf(r.get("差异数量"));
                diff = recorded == null ? 0d : recorded;
                r.put("差异数量", diff);
                if (rid != null) {
                    jdbc.update("UPDATE bl_stocktake SET 账面数量 = NULL, 差异数量 = NULL, 金额 = NULL WHERE id = ?", rid);
                }
            }
            if (Math.abs(diff) < 0.000001) continue;         // 账实相符:不动库存、不记流水
            if (diff > 0) {
                // 盘盈:入库。弃审时 applyIn(forward=false) 会把这次入库扣回去
                applyIn(code, ckdm, lot, diff, price, user, forward);
            } else {
                // 盘亏:出库(数量取绝对值)。弃审时 applyOut(forward=false) 会把扣掉的加回来
                applyOut(code, ckdm, lot, -diff, user, forward, false);
            }
        }
        stockFlow.postStocktakeFlow(no, rows, forward, user);
    }

    /** 调拨单明细(键与其它单据行同一套:code/lot/qty/price/金额/rid/name/spec/uom/单据类型/单据日期/经手人)。 */
    private List<Map<String, Object>> loadTransferRows(String no) {
        return jdbc.queryForList(
                "SELECT l.[存货编码] AS code, l.[批号] AS lot, l.[数量] AS qty, l.[单价] AS price, l.[金额] AS 金额,"
                        + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                        + " l.[调出仓库] AS 调出仓库, l.[调出仓库编码] AS 调出仓库编码, l.[调出仓位编码] AS 调出仓位,"
                        + " l.[调入仓库] AS 调入仓库, l.[调入仓库编码] AS 调入仓库编码, l.[调入仓位编码] AS 调入仓位,"
                        + " N'调拨单' AS 单据类型, h.[单据日期] AS 单据日期, h.[经手人] AS 经手人,"
                        + " NULL AS 往来单位"
                        + " FROM bl_transfer l LEFT JOIN bd_transfer h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'"
                        + " ORDER BY ISNULL(l.[序号], 0), l.id", no);
    }

    /** 盘点单明细(多带 仓位/账面数量/实盘数量/差异数量:审核要算差异、弃审要按留档反做)。 */
    private List<Map<String, Object>> loadStocktakeRows(String no) {
        return jdbc.queryForList(
                "SELECT l.[存货编码] AS code, l.[批号] AS lot, l.[仓库] AS 行仓库, l.[仓库编码] AS 行仓库编码,"
                        + " l.[仓位编码] AS 仓位,"
                        + " l.[账面数量] AS 账面数量, l.[实盘数量] AS 实盘数量, l.[差异数量] AS 差异数量,"
                        + " l.[单价] AS price, l.[金额] AS 金额,"
                        + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                        + " N'盘点单' AS 单据类型, h.[单据日期] AS 单据日期, h.[经手人] AS 经手人,"
                        + " NULL AS 往来单位"
                        + " FROM bl_stocktake l LEFT JOIN bd_stocktake h ON h.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'"
                        + " ORDER BY ISNULL(l.[序号], 0), l.id", no);
    }

    // ══════════════════ 库位(仓位)校验:2026-10-18 ══════════════════

    /**
     * 校验一条明细行的仓位,不合法直接抛错(整笔回滚)。
     *
     * <h3>为什么在**审核**时校验,而不是只靠保存时</h3>
     * 保存时的「仓位逐仓必填」({@code ButtonService.ensureBinRequiredFilled})是**通用弱校验**:
     * 它只看 `bs_wh.启用仓位管理` 这一个开关,而且只校验"载荷里带了该键"的行(局部提交会跳过)。
     * 库位是**账实口径的一部分**,必须在真正落账那一刻卡住 —— 所以这里再加一道强校验:
     *
     * <ol>
     *   <li><b>填了就必须对</b>:必须是**该仓库**名下、未停用、未作废的仓位。
     *       跨仓(拿 A 仓的仓位填 B 仓)、不存在、已停用 —— 一律拒绝。这条与仓库开不开仓位管理无关;</li>
     *   <li><b>该管就必须填</b>:该仓库**已维护仓位档案**(bs_wh_loc 有行)或 `bs_wh.启用仓位管理=1`
     *       ⇒ 仓位必填。比只看开关严一点,理由:某个仓一旦维护了仓位,业务上就是要按位管理,
     *       空着等于让库位字段形同虚设;</li>
     *   <li><b>不管就可以空</b>:仓库既没仓位档案也没启用仓位管理(系统现状:华北工控仓 346 行库存、
     *       仓位档案 0 条)⇒ 允许留空,审核照常。</li>
     * </ol>
     *
     * <p>⚠ 仓位的**记账边界**:`kucun`/`inh`/`outh` 只有 (物料, 仓库, 批号) 三键,**没有仓位维度**,
     * 所以仓位是**单据留痕**,不参与结存 —— 与采购入库单/销售出库单完全同口径(实测 964 行 0 行填过)。
     *
     * @param role 该仓位在本行的角色(「调出」/「调入」/空),只用于报错话术
     */
    private void ensureBinValid(String no, int lineNo, String itemCode, String whName, String whCkdm,
                                Object binValue, String role) {
        String bin = str(binValue);
        boolean manageByBin = warehouseManagesBin(whCkdm, whName);
        if (bin == null) {
            if (manageByBin) {
                throw new IllegalStateException(no + " 第 " + lineNo + " 行(存货 " + itemCode + ")的["
                        + (role.isEmpty() ? "仓位" : role + "仓位") + "]不能为空:仓库「"
                        + (whName != null ? whName : whCkdm) + "」已维护仓位档案/已启用仓位管理,必须指定库位");
            }
            return;                                  // 该仓不管仓位:允许留空
        }
        List<Map<String, Object>> hit = jdbc.queryForList(
                "SELECT TOP 1 l.[仓位编码] AS bin, l.[停用] AS stopped FROM bs_wh_loc l"
                        + " WHERE RTRIM(l.[仓位编码]) = RTRIM(?)"
                        + "   AND (RTRIM(ISNULL(l.[仓库编码], N'')) = RTRIM(?) OR RTRIM(ISNULL(l.[仓库], N'')) = RTRIM(?))"
                        + "   AND ISNULL(l.[asp_cancel], N'N') <> N'Y'"
                        + " ORDER BY l.id",
                bin, whCkdm == null ? "" : whCkdm, whName == null ? "" : whName);
        String label = role.isEmpty() ? "仓位" : role + "仓位";
        if (hit.isEmpty()) {
            throw new IllegalStateException(no + " 第 " + lineNo + " 行(存货 " + itemCode + ")的[" + label
                    + "]「" + bin + "」不属于仓库「" + (whName != null ? whName : whCkdm)
                    + "」,或该仓位已作废 —— 请重新选择");
        }
        Object stopped = hit.get(0).get("stopped");
        if (stopped != null && (Boolean.TRUE.equals(stopped) || "1".equals(String.valueOf(stopped))
                || "true".equalsIgnoreCase(String.valueOf(stopped)))) {
            throw new IllegalStateException(no + " 第 " + lineNo + " 行(存货 " + itemCode + ")的[" + label
                    + "]「" + bin + "」已停用,不能使用");
        }
    }

    /**
     * 该仓库是否"按仓位管理":有仓位档案(bs_wh_loc)或 bs_wh.启用仓位管理=1。
     * 仓库档案查不到(编码/名称都不匹配)⇒ 按档案判断不了,退回"有没有仓位档案"这一条;
     * 取不到就当**不要求**,宁可少拦也不误报(与 ButtonService.warehouseNeedsBin 同取向)。
     */
    private boolean warehouseManagesBin(String whCkdm, String whName) {
        try {
            Integer cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM bs_wh_loc l"
                            + " WHERE (RTRIM(ISNULL(l.[仓库编码], N'')) = RTRIM(?) OR RTRIM(ISNULL(l.[仓库], N'')) = RTRIM(?))"
                            + "   AND ISNULL(l.[asp_cancel], N'N') <> N'Y'",
                    Integer.class, whCkdm == null ? "" : whCkdm, whName == null ? "" : whName);
            if (cnt != null && cnt > 0) return true;
            Boolean flag = jdbc.queryForObject(
                    "SELECT TOP 1 CONVERT(bit, ISNULL([启用仓位管理], 0)) FROM bs_wh"
                            + " WHERE (RTRIM([仓库编码]) = RTRIM(?) OR RTRIM([仓库名称]) = RTRIM(?))"
                            + "   AND ISNULL(asp_cancel, 'N') <> 'Y'",
                    Boolean.class, whCkdm == null ? "" : whCkdm, whName == null ? "" : whName);
            return Boolean.TRUE.equals(flag);
        } catch (Exception e) {
            return false;
        }
    }

    /** 数值解析(null/空串/非数字 → null,与 {@link #num} 的"null→0"不同:这里要区分"没填"和"填了 0")。 */
    private static Double priceOf(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
    }

    /** 该 (物料,仓库,批号) 的结存单价(kucun.price);无该行 → null。 */
    private Double kucunPrice(String code, String ckdm, String lot) {
        List<Double> l = jdbc.queryForList("SELECT price FROM kucun WHERE wzdm = ? AND ckdm = ?"
                + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)", Double.class, code, ckdm, lot, lot);
        return l.isEmpty() ? null : l.get(0);
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
            if (!HIST_BACKFILL && yl != null && yl < -0.0001) throw new IllegalStateException("冲回将使现存量为负(物料 " + code + " 批 " + lot + " 余额 " + yl + "),库存已被消耗,不可冲回");
        }
        return n;
    }

    private void applyOut(String code, String ckdm, String lot, double qty, String user, boolean forward) {
        applyOut(code, ckdm, lot, qty, user, forward, true);
    }

    /**
     * 出库过账。
     *
     * @param requireLot 是否强制要求批号(默认 true)。2026-10-18 新增:调拨/盘点**不要求** ——
     *                   那条「出库行缺少批号请扫码」的守卫是给材料出库(扫码领料)设的,
     *                   调拨是非批号管理的货也要能移库、盘点是按 (物料,仓库,批号) 行调平,
     *                   没有批号的 kucun 行(lot_no IS NULL)同样得能被调到。
     *                   关掉它不影响"出到哪一行":lot 为 null 时下面的 NULL 安全匹配仍命中
     *                   `lot_no IS NULL` 那一条,不会串到别的批次。
     * @since 2026-10-19 {@link #LOT_STRICT}=false(验收期不按批次核销)时,本参数不再拦批号;
     *        扣减改为按 (物料, 仓库) 汇总核销,见 {@link #applyOutAggregated}。
     */
    private void applyOut(String code, String ckdm, String lot, double qty, String user, boolean forward, boolean requireLot) {
        if (requireLot && lot == null && forward && !HIST_BACKFILL && LOT_STRICT)
            throw new IllegalStateException("出库行缺少[批号]——请扫材料二维码补批号后再审核(物料 " + code + ")");
        if (!LOT_STRICT) {
            applyOutAggregated(code, ckdm, lot, qty, user, forward);
            return;
        }
        double sign = forward ? 1 : -1;
        int n = jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ?"
                        + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)",
                sign * qty, sign * qty, user, code, ckdm, lot, lot);
        if (n == 0) {
            if (!forward) throw new IllegalStateException("冲回失败:台账无该行(物料 " + code + " 批 " + lot + ")");
            if (!HIST_BACKFILL) throw new IllegalStateException("台账无该批库存(物料 " + code + " 批 " + lot + " 仓 " + ckdm + "),不能出库");
            // 历史回填:补一行 0 结存再扣(金蝶该键在 MES 台账尚无行,属区间外/其它类型移动造成的缺口)
            jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, ?, GETDATE(), 0, 0, ?, GETDATE(), 'N')", code, ckdm, lot, "stock:" + user);
            n = jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ?"
                            + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)",
                    sign * qty, sign * qty, user, code, ckdm, lot, lot);
        }
        Double yl = bal(code, ckdm, lot);
        if (!HIST_BACKFILL && yl != null && yl < -0.0001) {
            throw new IllegalStateException(forward
                    ? "现存量不足(物料 " + code + " 批 " + lot + " 出库后余额将变 " + yl + "),不能出库"
                    : "冲回将使现存量异常(物料 " + code + " 批 " + lot + " 余额 " + yl + "),不可弃审");
        }
    }

    /**
     * 出库过账(**验收期口径**:不按批号核销,2026-10-19)。
     *
     * <p>与 {@link #applyOut(String,String,String,double,String,boolean,boolean)} 的旧口径区别只有一个:
     * <b>余额守卫与扣减都按 (物料, 仓库) 汇总</b>,不再要求「该批号行自己」有余额。
     *
     * <h3>怎么扣</h3>
     * <ol>
     *   <li>先扣**本行批号那一行**(有就扣它,保持流水与结存尽量同批);</li>
     *   <li>不够的部分,按结存**从大到小**依次扣同物料同仓的其它批次 ——
     *       等于"这仓里这个物料还有货就能出",与金蝶「同一物料在仓里合计够」的口径一致;</li>
     *   <li>全部扣完仍不足 ⇒ **超出的部分记到本行批号那一行**,让它变负 ——
     *       这样总账(按物料合计)仍然准确,而负数会如实暴露"真缺货",不会被悄悄摊平。</li>
     * </ol>
     *
     * <p>弃审对称反做:按同样的顺序把数量加回去(先用本行批号,再补其它行)。
     * 注意这是**近似对称** —— 若审核后又发生了别的出入库,加回时落点可能与当初不同,
     * 但 (物料, 仓库) 总余额一定精确复原。上线切回批号核销后此问题消失。
     *
     * <p>⚠ <b>【上线前改写】</b>:正式上线当天把 {@link #LOT_STRICT} 改回 {@code true},
     * 本方法即不再被调用。详见 {@code docs/development/上线前必验-库存批次追溯.md}。
     */
    private void applyOutAggregated(String code, String ckdm, String lot, double qty, String user, boolean forward) {
        // 同物料同仓的全部结存行(含本行),按结存从大到小;排除 0 与负行(负行不参与"可供扣减")
        List<Map<String, Object>> hold = jdbc.queryForList(
                "SELECT id, lot_no, yl FROM kucun WHERE wzdm = ? AND ckdm = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY CASE WHEN ISNULL(yl,0) > 0 THEN 0 ELSE 1 END, ISNULL(yl,0) DESC, id",
                code, ckdm);
        double avail = 0d;
        for (Map<String, Object> h : hold) {
            double b = num(h.get("yl"));
            if (b > 0) avail += b;
        }
        // 本行批号对应的台账行(用于"优先扣自己那一批"与超出的落点)
        Long ownId = null;
        for (Map<String, Object> h : hold) {
            String l = h.get("lot_no") == null ? null : String.valueOf(h.get("lot_no")).trim();
            String cur = lot == null ? null : lot.trim();
            if (l == null ? cur == null || cur.isEmpty() : l.equals(cur)) { ownId = ((Number) h.get("id")).longValue(); break; }
        }

        if (forward) {
            // 守卫:汇总余额不足则拒绝(负数由红字冲回单承担,不在这里硬扣)
            if (!HIST_BACKFILL && avail + 0.0001 < qty) {
                Double ownBal = bal(code, ckdm, lot);
                throw new IllegalStateException("现存量不足(物料 " + code + " 仓 " + ckdm + " 可用合计 "
                        + round4(avail) + ",本次出库 " + round4(qty)
                        + ";本批号 " + (lot == null ? "(无)" : lot) + " 余额 " + (ownBal == null ? 0 : round4(ownBal))
                        + "),不能出库");
            }
            double remain = qty;
            // ① 本行批号优先
            if (ownId != null) {
                double take = Math.min(remain, Math.max(0d, ownBalOf(hold, ownId)));
                if (take > 0) { deduct(ownId, take, user); remain -= take; }
            }
            // ② 其余批次,从大到小
            for (Map<String, Object> h : hold) {
                if (remain <= 0.0001) break;
                Long id = ((Number) h.get("id")).longValue();
                if (ownId != null && id.equals(ownId)) continue;
                double b = num(h.get("yl"));
                if (b <= 0) continue;
                double take = Math.min(remain, b);
                if (take > 0) { deduct(id, take, user); remain -= take; }
            }
            // ③ 仍不足:超出部分记到本行批号那一行(它可能是负的,也可能不存在 → 建行)
            if (remain > 0.0001) {
                if (ownId != null) deduct(ownId, remain, user);
                else insertThenDeduct(code, ckdm, lot, remain, user);
            }
        } else {
            // 弃审:按同样顺序加回
            double remain = qty;
            if (ownId != null) { deduct(ownId, -qty, user); remain = 0; }
            if (remain > 0.0001) {
                for (Map<String, Object> h : hold) {
                    if (remain <= 0.0001) break;
                    Double b = bal(code, ckdm, h.get("lot_no") == null ? null : String.valueOf(h.get("lot_no")));
                    if (b == null || b <= 0) continue;
                    double take = Math.min(remain, b);
                    deduct(((Number) h.get("id")).longValue(), -take, user);
                    remain -= take;
                }
                if (remain > 0.0001) insertThenDeduct(code, ckdm, lot, -remain, user);
            }
        }
    }

    /** 取某行在 hold 结果集里的结存 */
    private static double ownBalOf(List<Map<String, Object>> hold, Long id) {
        for (Map<String, Object> h : hold) if (((Number) h.get("id")).longValue() == id) return num(h.get("yl"));
        return 0d;
    }

    /** 对某台账行做扣减(take>0)或加回(take<0) */
    private void deduct(Long id, double take, String user) {
        jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                + " asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?", take, take, user, id);
    }

    /** 该批号台账行不存在:先建一行 0 结存,再按 take 增减 */
    private void insertThenDeduct(String code, String ckdm, String lot, double take, String user) {
        jdbc.update("INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)"
                + " VALUES (?, ?, ?, GETDATE(), 0, 0, 0, ?, GETDATE(), 'N')", code, ckdm, lot, "stock:" + user);
        jdbc.update("UPDATE kucun SET ckl = ckl + ?, yl = yl - ?, update_date = GETDATE(),"
                        + " asp_user2 = ?, asp_time2 = GETDATE() WHERE wzdm = ? AND ckdm = ?"
                        + " AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)",
                take, take, user, code, ckdm, lot, lot);
    }

    private static double round4(double v) { return Math.round(v * 10000d) / 10000d; }

    /**
     * 总量守卫:该 (物料, 仓库) 的**可出库总量**(只算正结存行)。
     * 供外部(如面板保存时的"现存量提取")按汇总口径提示,不参与过账。
     */
    public double availableQty(String code, String ckdm) {
        List<Double> l = jdbc.queryForList("SELECT ISNULL(SUM(yl),0) FROM kucun WHERE wzdm = ? AND ckdm = ?"
                + " AND ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) > 0", Double.class, code, ckdm);
        return l.isEmpty() || l.get(0) == null ? 0d : l.get(0);
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
        // 2026-10-14:其他入库/其他出库 两段恢复,经手人取头表(其他出库有、其他入库无),往来单位仍不取
        //   (保持与 v_stock_movement 同口径;新表虽新增 供应商/部门 列,但改流水口径会牵动既有报表)。
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
            // 2026-10-14 恢复:其他入库(段 3)。表结构为**按金蝶 inv_other_in 重建**的新表:
            //   行表有 存货编码/存货名称/规格型号/仓库/仓库编码/批号/数量/单价/金额/计量单位(与出库段同形);
            //   头表**没有仓库列**(仓库在行上)⇒ 头仓库与行仓库同源(旧 OTHER_OUT 段同款处理);
            //   头表没有经手人(其他入库是供应商口径)⇒ 经手人 NULL;往来单位按 v_stock_movement 旧口径不取
            //   (该视图只有 1 采购入库 / 5 销售出库 两段有往来单位)。
            case "OTHER_IN" -> jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], l.[仓库编码] AS [行仓库编码], l.[仓库] AS [头仓库],"
                            + " l.[批号] AS lot, l.[数量] AS qty, l.[单价] AS price,"
                            + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            // 金额 NULL 安全(2026-10-14):金蝶这三类单据的价格族**天然为空**(实测非空率 0%),
                            // 而 v_stock_movement 把 inh.金额 透传成「收入金额」,再进 inv_cost_ledger(该列 NOT NULL)
                            // ⇒ 金额留 NULL 会让成本重算整笔失败(实测报「不能将值 NULL 插入列 '收入金额'」)。
                            // 口径:金额缺失时按 0 记(不臆造成本);有单价时按 单价×数量。
                            + " ISNULL(l.[金额], ISNULL(l.[单价], 0) * l.[数量]) AS 金额,"
                            + " N'其他入库单' AS [单据类型], h.[单据日期] AS [单据日期], NULL AS [往来单位], NULL AS [经手人]"
                            + " FROM bl_other_in l LEFT JOIN bd_other_in h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
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
            // 2026-10-14 恢复:其他出库(段 7)。新表按金蝶 inv_other_out 重建:
            //   行表 存货编码/存货名称/规格型号/仓库/仓库编码/批号/数量/单价/金额/计量单位;
            //   头表有 部门 + 经手人 ⇒ 经手人取头表(与旧实现一致);头表无仓库列 ⇒ 头仓库与行仓库同源。
            //   price 传 NULL(与其他出库/材料出库同款:出库按结存成本计价,不用单据单价)。
            case "OTHER_OUT" -> jdbc.queryForList(
                    "SELECT l.[存货编码] AS code, l.[仓库] AS [行仓库], l.[仓库编码] AS [行仓库编码], l.[仓库] AS [头仓库],"
                            + " l.[批号] AS lot, l.[数量] AS qty, NULL AS price,"
                            + " l.id AS rid, l.[存货名称] AS name, l.[规格型号] AS spec, l.[计量单位] AS uom,"
                            + " ISNULL(l.[金额], ISNULL(l.[单价], 0) * l.[数量]) AS 金额,"
                            + " N'其他出库单' AS [单据类型], h.[单据日期] AS [单据日期], NULL AS [往来单位], h.[经手人] AS [经手人]"
                            + " FROM bl_other_out l LEFT JOIN bd_other_out h ON h.[单据编号] = l.[单据编号]"
                            + " WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel, 'N') <> 'Y'", no);
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
        String[] pair = resolveWhPair(whCode, whName);
        if (pair == null) return null;
        row.put("仓库编码", pair[0]);
        row.put("仓库名称", pair[1]);
        return pair[0];
    }

    /**
     * 仓库解析的**纯函数形态**(2026-10-18):返回 {仓库编码, 仓库名称},解析不到返回 null。
     *
     * <p>为什么不复用 {@link #resolveWh}:它把结果写死在行上的 `仓库编码`/`仓库名称` 两个键里,
     * 而调拨单一行要解析**两个**仓库(调出/调入),写同一对键会互相覆盖。
     * 逻辑与 resolveWh 逐字相同(编码优先、名称兜底),两边不许各改一半 —— resolveWh 现在就是本方法的薄包装。
     */
    private String[] resolveWhPair(String whCode, String whName) {
        if (whCode != null && !whCode.isBlank()) {
            List<Map<String, Object>> hit = jdbc.queryForList(
                    "SELECT [仓库编码] AS ckdm, [仓库名称] AS ckmc FROM bs_wh WHERE [仓库编码] = ? AND ISNULL([状态], N'启用') = N'启用'",
                    whCode.trim());
            if (!hit.isEmpty()) {
                return new String[]{str(hit.get(0).get("ckdm")), str(hit.get(0).get("ckmc"))};
            }
        }
        String byName = resolveCkdm(whName);
        return byName == null ? null : new String[]{byName, str(whName)};
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
