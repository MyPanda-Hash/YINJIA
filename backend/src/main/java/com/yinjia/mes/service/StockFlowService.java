package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 库存流水读写(inh 入库 / outh 出库)。2026-09-30 用户口径:库存改为三表,
 * kucun 退为**结存缓存**、流水为唯一真源。
 *
 * 与 {@link StockLedgerService} 的分工:
 *   · StockLedgerService 负责**结存**(kucun.yl/rkl/ckl)与业务守卫(现存量不足、仓库档案必须存在);
 *   · 本类负责**流水**(inh/outh)的写入与红冲。
 * 两者由 StockLedgerService 在**同一事务**内先后调用(apply 里改完 kucun 之后),
 * 一旦有一边失败,整笔回滚,不会出现"结存动了流水没动"。
 *
 * 幂等:(src, rid) 上有唯一索引 —— 同一单据行重复审核不重复记流水。
 * 弃审 = 软删(asp_cancel='Y')保留痕迹,不物理删除;弃审后**重新审核**是把那条流水"复活"
 * (改回 'N' 并刷新单据侧字段),而不是新插一行 —— 否则结存加回去了、流水还挂着红冲,
 * 「结存 == Σ流水」必然对不上。
 */
@Service
public class StockFlowService {

    private static final Logger log = LoggerFactory.getLogger(StockFlowService.class);

    private final JdbcTemplate jdbc;
    private final StockWarnService warn;

    public StockFlowService(JdbcTemplate jdbc, StockWarnService warn) {
        this.jdbc = jdbc;
        this.warn = warn;
    }

    /**
     * 入库面板(src 1..4,与 v_stock_movement 的段号同口径)。
     *
     * <p>2026-10-08:OTHER_IN(3)/OUTSOURCE_IN(4) 及其他出入库单据面板整体下架
     * (tools/migrate-drop-extra-docs-pu-req-20261008.sql)—— 段号 4/8 自此无面板使用;
     * 段号本身是流水表的既有口径(v_stock_movement 按 src 分段),不回收,以免历史流水无法解读。
     * <p>2026-10-14:**段号 3 恢复使用** —— 其他入库单面板按金蝶字段重建并重新接入库存记账
     * (用户口径「要恢复库存记账」);段号 4(委外入库)仍无面板。
     */
    private static int inSrc(String panelCode) {
        return switch (panelCode) {
            case "PURCHASE_IN" -> 1;
            case "FINISH_IN" -> 2;
            case "OTHER_IN" -> 3;
            default -> -1;
        };
    }

    /** 出库面板(src 5..8);2026-10-14 起段号 7(其他出库)重新启用,8(委外发料)仍无面板。 */
    private static int outSrc(String panelCode) {
        return switch (panelCode) {
            case "SALE_OUT" -> 5;
            case "MATERIAL_OUT" -> 6;
            case "OTHER_OUT" -> 7;
            default -> -1;
        };
    }

    // ── 调拨 / 盘点段号(2026-10-18,源 tools/migrate-transfer-stocktake-20261018.sql 头注) ──
    // 4(委外入库)/8(委外发料)是已下架委外段的保留号,按既有口径**不回收**,新段顺延编号:
    //   9  调拨入库 / 10 调拨出库 / 11 盘点盘盈 / 12 盘点盘亏
    // 一张调拨单的一行会产生**两条流水**(9 与 10),rid 相同、src 不同 ⇒ 不撞 UX_*_src_rid 唯一索引;
    // 盘点行的盘盈/盘亏互斥,同样各占一段。
    // v_stock_movement 无需改动:它按 src 透传、业务类型只分 入库/出库,新段自动进台账/收发存/成本重算。
    static final int SRC_TRANSFER_IN = 9;
    static final int SRC_TRANSFER_OUT = 10;
    static final int SRC_STOCKTAKE_IN = 11;
    static final int SRC_STOCKTAKE_OUT = 12;

    /**
     * 写流水(单方向面板:采购入库/产成品入库/其他入库/销售出库/材料出库/其他出库)。
     *
     * @param rows 已由 StockLedgerService.loadRows 取好的单据行(键:code/lot/qty/price/金额/
     *             name/spec/uom/rid/单据类型/单据日期/往来单位/经手人/含税金额/税额;后两个键只有
     *             采购入库·销售出库两段有,其余段落 NULL);仓库编码/仓库名称由
     *             StockLedgerService.resolveWh 解析后回填到行上 —— 流水的三键必须与 kucun 完全一致
     * @param forward true=审核(插入流水) / false=弃审(红冲)
     * @return 影响行数
     */
    public int postFlow(String panelCode, String no, List<Map<String, Object>> rows, boolean forward, String user) {
        int inS = inSrc(panelCode), outS = outSrc(panelCode);
        if (inS < 0 && outS < 0) return 0;
        if (rows == null || rows.isEmpty()) return 0;
        return post(inS > 0 ? inS : outS, inS > 0, no, rows, forward, user, true);
    }

    /**
     * **调拨单流水**:一行 → 两条(调出仓 outh src=10 + 调入仓 inh src=9)。
     *
     * <p>为什么必须两条而不是"净额不动不记流水":流水是库存的唯一真源,仓库间移库改变的是**每个仓库**
     * 的结存(公司总量不变)。只记一条或一条不记 ⇒ 库存台账/收发存汇总/成本重算全部看不见这次移动,
     * 调出仓的货凭空消失、调入仓的货凭空出现。
     *
     * <p>调用方(StockLedgerService.applyTransfer)已在**同一事务**里把两条腿的 kucun 都改完,
     * 这里只负责把同样的两腿写进流水;任一步抛错整笔回滚。
     *
     * @param rows 已解析仓库的行(键含 调出仓库编码/调出仓库/调入仓库编码/调入仓库 与回填的 仓库编码/仓库名称)
     */
    public int postTransferFlow(String no, List<Map<String, Object>> rows, boolean forward, String user) {
        if (rows == null || rows.isEmpty()) return 0;
        List<Map<String, Object>> outRows = new ArrayList<>(rows.size());
        List<Map<String, Object>> inRows = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            if (num(r.get("qty")) == 0) continue;                    // 零行两腿都不记
            String outCode = str(r.get("调出仓库编码")), inCode = str(r.get("调入仓库编码"));
            if (outCode == null || inCode == null) continue;          // 仓库没解析出来 = 该行没动过 kucun
            // 出库腿:仓库覆盖成调出仓;出库按结存成本计价 ⇒ 单价不传(price 置 null,与其他出库段同口径)
            Map<String, Object> o = new LinkedHashMap<>(r);
            o.put("仓库编码", outCode);
            o.put("仓库名称", str(r.get("调出仓库")));
            o.put("price", null);
            outRows.add(o);
            // 入库腿:仓库覆盖成调入仓;入库要带单价/金额(否则成本重算把这次移库当成 0 金额收入)
            Map<String, Object> i = new LinkedHashMap<>(r);
            i.put("仓库编码", inCode);
            i.put("仓库名称", str(r.get("调入仓库")));
            inRows.add(i);
        }
        // 出库腿走预警闸门(与其余出库同口径);入库腿不设闸门(入库只会让余额变大)
        int n = post(SRC_TRANSFER_OUT, false, no, outRows, forward, user, true);
        n += post(SRC_TRANSFER_IN, true, no, inRows, forward, user, false);
        return n;
    }

    /**
     * **盘点单流水**:按行上的「差异数量」分成盘盈(inh src=11)/ 盘亏(outh src=12)两批。
     *
     * <p>为什么要拆两批而不是"带符号一条":inh/outh 是两张表,而差异的正负决定它在哪张表里;
     * 且盘点行的方向在弃审后重审时**可能翻转**(比如上次盘盈 5、这次实盘改成盘亏 3),
     * 那时会分别在两张表各留一条 —— 已冲销的那条是 asp_cancel='Y',不会被读口径算进去。
     *
     * @param rows 已解析仓库、且已把「差异数量」算好写回行上的明细行
     */
    public int postStocktakeFlow(String no, List<Map<String, Object>> rows, boolean forward, String user) {
        if (rows == null || rows.isEmpty()) return 0;
        List<Map<String, Object>> gains = new ArrayList<>();
        List<Map<String, Object>> losses = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String code = str(r.get("仓库编码"));
            if (code == null) continue;                               // 仓库没解析出来 = 该行没动过 kucun
            double diff = num(r.get("差异数量"));
            if (diff == 0) continue;                                  // 账实相符:不记流水
            Map<String, Object> c = new LinkedHashMap<>(r);
            c.put("qty", Math.abs(diff));
            (diff > 0 ? gains : losses).add(c);
        }
        // 两边都不设预警闸门:盘亏是"把账调到实盘",按定义不该被预警数量挡住;
        // 盘盈只会让余额变大,本就没有闸门。
        int n = post(SRC_STOCKTAKE_IN, true, no, gains, forward, user, false);
        n += post(SRC_STOCKTAKE_OUT, false, no, losses, forward, user, false);
        return n;
    }

    /**
     * 写一批流水的公共实现(插入 / 复活 / 红冲 + 幂等)。
     *
     * @param src       段号(见上方常量)
     * @param inbound   true 写 inh / false 写 outh
     * @param checkWarn 是否过「出库后余额 &lt; 预警数量」闸门(只对 outbound 生效);
     *                  调拨出库=true、盘点盘亏=false(理由见各调用点)
     */
    private int post(int src, boolean inbound, String no, List<Map<String, Object>> rows,
                     boolean forward, String user, boolean checkWarn) {
        if (rows == null || rows.isEmpty()) return 0;
        String tbl = inbound ? "inh" : "outh";
        int n = 0;
        // 出库审批闸门(用户 2026-10-15 第十六轮):出库后该批次余额 < 预警数量 ⇒ 抛异常 ⇒ 事务回滚、审批失败并提示。
        //   一张单可能多行打同一批次 ⇒ acc 按 物料|仓库|批号 累计"本单已出量",逐行单独比会漏判。
        Map<String, java.math.BigDecimal> warnAcc = new java.util.HashMap<>();
        for (Map<String, Object> r : rows) {
            Object rid = r.get("rid");
            if (rid == null) continue;                       // 没有来源行 id 就不记流水(唯一键的一半,无法幂等)
            if (str(r.get("仓库编码")) == null) continue;      // 仓库没解析出来 = 该行没动过 kucun(见 apply 的跳过分支)
            double qty = num(r.get("qty"));
            if (qty == 0) continue;                          // 零行不过账,也不记流水
            // 出库审批闸门(用户第十六轮):**首次审核(insert)与弃审后重审(revive)都要过闸** ——
            //   放在幂等查询**之前**,否则"弃审 → 调预警 → 重审"能绕过校验。
            // 2026-10-18:加 checkWarn 开关(调拨出库=true / 盘点盘亏=false,理由见各调用点);
            //   顺带合并了原文件里**同一段被贴了两遍**的重复代码(两次调用会把 warnAcc 重复累计,见 warnAcc.merge)。
            if (forward && !inbound && checkWarn) {
                warn.checkOutbound(no, str(r.get("code")), str(r.get("仓库编码")), str(r.get("lot")),
                        java.math.BigDecimal.valueOf(num(r.get("qty"))), warnAcc);
            }
            // 幂等:先查 (src, rid) 是否已记过(唯一索引兜底),再决定 插 / 复活 / 红冲
            List<String> cancelFlag = jdbc.queryForList(
                    "SELECT ISNULL(asp_cancel, 'N') FROM " + tbl + " WHERE src = ? AND rid = ?", String.class, src, rid);
            if (!cancelFlag.isEmpty()) {
                boolean cancelled = "Y".equalsIgnoreCase(cancelFlag.get(0));
                if (forward && cancelled) {
                    n += revive(tbl, inbound, r, no, user, src, rid);
                } else if (!forward && !cancelled) {
                    // 弃审:软删(asp_cancel='Y')保留痕迹;不物理删除
                    n += jdbc.update("UPDATE " + tbl + " SET asp_cancel = 'Y', asp_user4 = ?, asp_time4 = GETDATE()"
                            + " WHERE src = ? AND rid = ? AND ISNULL(asp_cancel,'N') <> 'Y'", user, src, rid);
                }
                continue;                                    // 已记过(未弃审的重复审核)/ 已冲过:不重复写
            }
            if (!forward) continue;                          // 没记过流水,弃审时无流水可冲
            n += insert(tbl, inbound, r, no, user, src, rid);
        }
        if (n > 0) log.info("[库存流水] {} {} {} {} 行(src={})", tbl, no, forward ? "写入" : "红冲", n, src);
        return n;
    }

    /** 插入一条流水(inh/outh 列名不同,列清单由 {@link #flowCols} 统一给)。 */
    private int insert(String tbl, boolean inbound, Map<String, Object> r, String no, String user, int src, Object rid) {
        Map<String, Object> cols = flowCols(inbound, r, no);
        StringBuilder cn = new StringBuilder("src, rid"), qm = new StringBuilder("?, ?");
        List<Object> args = new ArrayList<>(List.of(src, rid));
        for (Map.Entry<String, Object> e : cols.entrySet()) {
            cn.append(", ").append(e.getKey());
            qm.append(", ?");
            args.add(e.getValue());
        }
        cn.append(", asp_user1, asp_time1, asp_cancel");
        qm.append(", ?, GETDATE(), 'N'");
        args.add(user);
        return jdbc.update("INSERT INTO " + tbl + " (" + cn + ") VALUES (" + qm + ")", args.toArray());
    }

    /** 弃审后重新审核:复活那条流水并刷新单据侧字段(弃审到重审之间单据可能被改过)。 */
    private int revive(String tbl, boolean inbound, Map<String, Object> r, String no, String user, int src, Object rid) {
        StringBuilder set = new StringBuilder(
                "asp_cancel = 'N', asp_user4 = NULL, asp_time4 = NULL, asp_user1 = ?, asp_time1 = GETDATE()");
        List<Object> args = new ArrayList<>(List.of(user));
        for (Map.Entry<String, Object> e : flowCols(inbound, r, no).entrySet()) {
            set.append(", ").append(e.getKey()).append(" = ?");
            args.add(e.getValue());
        }
        args.add(src);
        args.add(rid);
        return jdbc.update("UPDATE " + tbl + " SET " + set + " WHERE src = ? AND rid = ?", args.toArray());
    }

    /**
     * 一条流水的「列 → 值」。inh 与 outh 列名不同:inh 落 单价 + 金额,outh 落 单据金额
     * (outh 的成本单价/成本金额由 InvCostService 回填,不在这里写)。
     * INSERT 与「复活 UPDATE」共用这份清单,避免两份字段映射日后各改一半。
     * 金额/单价为空表示"单据上没填",原样落 NULL(与 v_stock_movement 的口径一致)。
     */
    private static Map<String, Object> flowCols(boolean inbound, Map<String, Object> r, String no) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("单据类型", str(r.get("单据类型")));
        m.put("单据日期", r.get("单据日期"));
        m.put("物料编码", str(r.get("code")));
        m.put("物料名称", str(r.get("name")));
        m.put("规格型号", str(r.get("spec")));
        m.put("计量单位", str(r.get("uom")));
        m.put("仓库编码", str(r.get("仓库编码")));
        m.put("仓库名称", str(r.get("仓库名称")));
        m.put("批号", str(r.get("lot")));
        m.put("数量", num(r.get("qty")));
        m.put("往来单位", str(r.get("往来单位")));
        m.put("经手人", str(r.get("经手人")));
        if (inbound) {
            m.put("单价", r.get("price"));
            m.put("金额", r.get("金额"));
        } else {
            m.put("单据金额", r.get("金额"));
        }
        // 含税金额/税额(2026-10-03 任务 7):inh 与 outh 都加了这两列(见 migrate-stock-flow-tax-cols-2026-09-30.sql)。
        // 两表同名同义 ⇒ 不放进上面的 if/else。口径由 loadRows 给:只有 采购入库/销售出库 两段取键,
        // 其余 6 段与期初没有这两个键 ⇒ r.get 返回 null ⇒ 原样落 NULL(与 v_stock_movement 同口径)。
        m.put("含税金额", r.get("含税金额"));
        m.put("税额", r.get("税额"));
        return m;
    }

    /** 与 StockLedgerService.str 同口径(去空白、空串→null):流水与结存的键必须逐字一致。 */
    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }
}
