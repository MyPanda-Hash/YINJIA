package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 库存移动加权成本物化表(inv_cost_ledger)的重算。
 *
 * <p>为什么成本要物化、而不是做成视图:真·移动加权平均本质是递归(无闭式解)。
 * 递归 CTE 可以建视图,但**视图不能带 OPTION (MAXRECURSION)**,走默认 100 行上限;
 * 库存台账 235 行 → 直接报「完成执行语句前已用完最大递归 100」。
 * 退而用「累计入库加权平均」虽是闭式、可进视图,但口径不同:实测 2,268,221.49 vs 真值
 * 3,092,184.28(差 27%),不可当近似互换。
 *
 * <p>为什么不用存储过程:迁移脚本以 yinjia 执行,而 yinjia 只是 db_ddladmin/db_datareader/
 * db_datawriter(非 db_owner);在 dbo 架构下创建的对象归 dbo 所有,于是 yinjia 既不能
 * EXECUTE 也无权 GRANT EXECUTE,运行期审核钩子会直接报权限错误。
 * Java 侧直接跑这个 SQL 反而没有权限问题 —— OPTION (MAXRECURSION 0) 只是语句的一部分。
 *
 * <p>分区口径 = **(仓库键, 存货编码),不含批号**。批号进分区键会让分区数从 78 涨到 225,
 * 其中 114 个(51%)「只出无进」→ 出库成本恒 0、结存数量为负,报表不可用。
 * 根因不是销售批号为空(空批号销售仅 13 行,其中只有 1 行的存货本有入库),
 * 而是同一批号值在采购侧与销售侧挂到了不同的 (仓库,存货) 组合上。
 * 故批号只作台账**明细列**,不做成本分区、不进 balance/summary 的 GROUP BY。
 *
 * <p>与 tools/migrate-inv-report-fields.sql 的分工:迁移建视图与物化表(不预填),
 * 本类负责运行期重算;二者口径必须一致,改动请同步该文件头部的注释。
 */
@Service
public class InvCostService {

    private final JdbcTemplate jdbc;

    private static final Logger log = LoggerFactory.getLogger(InvCostService.class);

    /** 结存 vs 流水 的对账容差(两个数量/金额都到 0.01 即视为一致) */
    private static final double RECONCILE_TOL = 0.01;
    /** 差异三键最多列出几个(只报警不刷屏) */
    private static final int RECONCILE_SAMPLE = 10;

    public InvCostService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 递归主体:出库按**出库前**的移动加权单价计价(结存金额/结存数量;除零则 0)。
     * 结存金额 = 前期结存金额 + 本行收入金额 − 本行发出成本。
     * 全部金额列显式 CAST 到 decimal(38,10):不加会报「定位点类型和递归部分的类型不匹配」。
     */
    private static final String RECURSE =
            "WITH s AS ("
            + " SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,"
            + " ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn"
            + " FROM dbo.v_stock_movement%WHERE%"
            + "), rec AS ("
            // 定位点:分区首行,此前结存为 0 → 出库按 0 计价(只出无进的分区,出库成本即 0)
            + " SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,"
            + " CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,"
            + " CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END)"
            + "      AS decimal(38,10)) AS 结存金额,"
            + " CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END)"
            + "      AS decimal(38,10)) AS 发出成本金额,"
            + " CAST(收入数量 AS decimal(38,10)) AS 收入数量,"
            + " CAST(发出数量 AS decimal(38,10)) AS 发出数量,"
            + " CAST(收入金额 AS decimal(38,10)) AS 收入金额"
            + " FROM s WHERE rn = 1"
            + " UNION ALL"
            + " SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,"
            + " CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),"
            + " CAST(rec.结存金额 + s.收入金额"
            + "      - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END)"
            + "      AS decimal(38,10)),"
            + " CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END)"
            + "      AS decimal(38,10)),"
            + " CAST(s.收入数量 AS decimal(38,10)),"
            + " CAST(s.发出数量 AS decimal(38,10)),"
            + " CAST(s.收入金额 AS decimal(38,10))"
            + " FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1"
            + ")"
            + " INSERT INTO dbo.inv_cost_ledger"
            + " (src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,"
            + "  结存数量, 移动加权单价, 结存金额, 发出成本金额, 重算时间)"
            + " SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,"
            + " CAST(收入数量 AS decimal(18,4)), CAST(发出数量 AS decimal(18,4)), CAST(收入金额 AS decimal(18,4)),"
            + " CAST(结存数量 AS decimal(18,4)),"
            + " CAST(CASE WHEN 结存数量 <> 0 THEN 结存金额 / 结存数量 ELSE 0 END AS decimal(18,6)),"
            + " CAST(结存金额 AS decimal(18,4)), CAST(发出成本金额 AS decimal(18,4)), SYSDATETIME()"
            + " FROM rec"
            + " OPTION (MAXRECURSION 0)";

    /** 全量重算。单据审核/弃审后调它(235 行流水,成本可忽略)。 */
    @Transactional
    public int recalcAll() {
        return recalc(null, null);
    }

    /**
     * 重算指定范围(两个入参都传 NULL 即全量)。
     * 范围按 仓库键 / 存货编码 过滤 —— 二者都落在分区边界上,故范围内每个分区都是完整的,
     * 重算结果与全量一致。若某张单据改动了仓库或其存货编码,旧分区行不会被本次 DELETE 覆盖,
     * 需走全量重算(审核钩子即调全量)。
     *
     * @return 写入行数
     */
    @Transactional
    public int recalc(String 仓库键, String 存货编码) {
        List<String> conds = new ArrayList<>();
        List<Object> args = new ArrayList<>();
        if (仓库键 != null) { conds.add("仓库键 = ?"); args.add(仓库键); }
        if (存货编码 != null) { conds.add("存货编码 = ?"); args.add(存货编码); }
        String where = conds.isEmpty() ? "" : " WHERE " + String.join(" AND ", conds);

        jdbc.update("DELETE FROM dbo.inv_cost_ledger" + where, args.toArray());
        return jdbc.update(RECURSE.replace("%WHERE%", where), args.toArray());
    }

    /**
     * 启动自检入口({@code MesApplication#invCostReconciler} 调它):
     * ① 成本物化表 inv_cost_ledger 与流水不一致则全量重算;
     * ② 结存(kucun) 与库存流水(inh 正 − outh 负) 按三键对账。
     * 两者各自 try/catch,**任一失败都只记一行日志、不阻断启动**(见各自方法)。
     *
     * <p>⚠ 为什么①的方法体被搬进了私有方法:① 里有一句 `if (same) return;`,
     * 而「成本一致」正是绝大多数启动的情形 ⇒ 若有代码直接追加在本方法**末尾**,
     * 在正常路径上永远执行不到(自检成摆设)。故①的方法体逐字未改地移入
     * {@link #reconcileCostOnStartup()},由本方法顺序调用。
     */
    public void reconcileOnStartup() {
        reconcileCostOnStartup();
        reconcileStockOnStartup();
    }

    /**
     * 启动自检:物化表与流水不一致则全量重算。
     * 必要性 —— 金蝶同步会把已审核单据直接写进 bl_(行表)与 bd_(头表),这类写入不经过 ButtonService 的
     * 审核动作,钩子不会触发,成本会静默过期。以「行数 + 数量金额合计」双指纹判断,
     * 只有真的不一致才重算(本机 235 行,毫秒级)。
     */
    private void reconcileCostOnStartup() {
        try {
            Map<String, Object> r = jdbc.queryForMap(
                    "SELECT (SELECT COUNT(*) FROM dbo.v_stock_movement) AS mv_cnt,"
                            + " (SELECT COUNT(*) FROM dbo.inv_cost_ledger) AS c_cnt,"
                            + " (SELECT ISNULL(SUM(收入数量 + 发出数量 + 收入金额),0) FROM dbo.v_stock_movement) AS mv_sum,"
                            + " (SELECT ISNULL(SUM(收入数量 + 发出数量 + 收入金额),0) FROM dbo.inv_cost_ledger) AS c_sum");
            boolean same = num(r.get("mv_cnt")).compareTo(num(r.get("c_cnt"))) == 0
                    && num(r.get("mv_sum")).compareTo(num(r.get("c_sum"))) == 0;
            if (same) return;
            int n = recalcAll();
            System.out.println("[YINJIA-MES] 库存成本物化表与流水不一致，已全量重算 " + n + " 行");
        } catch (Exception e) {
            // 自检失败不阻断启动:报表会显示成本为 0,用户可点「重算成本」恢复
            System.err.println("[YINJIA-MES] 库存成本自检失败(不影响启动): " + e.getMessage());
        }
    }

    /**
     * 2026-09-30 追加:结存(kucun)必须等于流水(inh 数量 正、outh 数量 负)按三键的净额。
     *
     * <p>为什么必须有它 —— 三表化之后**流水是唯一真源**,kucun 只是结存缓存。任何绕开
     * {@code StockLedgerService} 的写入(历史上出过:金蝶旁路直写的已审核单据"进报表不进台账")
     * 都会让两者悄悄分叉,而界面上看不出任何异常。启动时喊出来是最后一道防线。
     *
     * <p>口径:两边都过滤 ISNULL(asp_cancel,'N') &lt;&gt; 'Y';容差 {@value #RECONCILE_TOL}。
     * 期初行(src=0)本身就在 inh 里,天然计入正数,无需特判。
     * 比对是**双向**的:除 kucun 逐行核对外,还核对"有流水净额、kucun 里却没有这一行"——
     * 只按 kucun 遍历会漏掉"结存行整个缺失"这种分叉。
     *
     * <p>失败不阻断启动(与①同风格):异常一律 catch 住记一行 warn。
     */
    private void reconcileStockOnStartup() {
        try {
            // 一条 UNION ALL 直接算净额(inh 正 / outh 负):串起来比两个单表方法再相减更不容易错
            List<Map<String, Object>> flow = jdbc.queryForList(
                    "SELECT 物料编码, 仓库编码, 批号, SUM(净额) AS net FROM ("
                            + " SELECT 物料编码, 仓库编码, 批号, 数量 AS 净额 FROM dbo.inh"
                            + "   WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                            + " UNION ALL"
                            + " SELECT 物料编码, 仓库编码, 批号, -数量 FROM dbo.outh"
                            + "   WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                            + ") t GROUP BY 物料编码, 仓库编码, 批号");
            Map<String, Double> byFlow = new LinkedHashMap<>();
            for (Map<String, Object> r : flow) {
                byFlow.put(key3(r.get("物料编码"), r.get("仓库编码"), r.get("批号")), num(r.get("net")).doubleValue());
            }

            List<Map<String, Object>> stock = jdbc.queryForList(
                    "SELECT wzdm, ckdm, lot_no, yl FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            Map<String, Double> byStock = new LinkedHashMap<>();
            for (Map<String, Object> r : stock) {
                byStock.put(key3(r.get("wzdm"), r.get("ckdm"), r.get("lot_no")), num(r.get("yl")).doubleValue());
            }

            int bad = 0;
            StringBuilder sample = new StringBuilder();
            for (Map.Entry<String, Double> e : byStock.entrySet()) {
                double expect = byFlow.getOrDefault(e.getKey(), 0d);
                if (Math.abs(e.getValue() - expect) > RECONCILE_TOL) {
                    bad++;
                    if (bad <= RECONCILE_SAMPLE) {
                        sample.append(e.getKey()).append("(结存=").append(e.getValue())
                                .append(" 流水=").append(expect).append(") ");
                    }
                }
            }
            for (Map.Entry<String, Double> e : byFlow.entrySet()) {
                // kucun 里没有这一行:净额为 0 时两边都对,不算差异
                if (byStock.containsKey(e.getKey()) || Math.abs(e.getValue()) <= RECONCILE_TOL) continue;
                bad++;
                if (bad <= RECONCILE_SAMPLE) {
                    sample.append(e.getKey()).append("(结存=无此行 流水=").append(e.getValue()).append(") ");
                }
            }

            if (bad == 0) {
                log.info("[库存对账] 结存 == Σ流水,一致({} 个三键)", byStock.size());
            } else {
                log.warn("[库存对账] 发现 {} 个三键不一致,前 {} 个:{}", bad, RECONCILE_SAMPLE, sample.toString().trim());
            }
        } catch (Exception e) {
            // 与成本自检同风格:对账本身出错也不能把启动打断
            log.warn("[库存对账] 跳过:{}", e.getMessage());
        }
    }

    /** 对账键:`物料编码|仓库编码|批号`(null 统一成字面量 "null",与流水侧口径一致) */
    private static String key3(Object a, Object b, Object c) {
        return String.valueOf(a) + '|' + b + '|' + c;
    }

    private static BigDecimal num(Object o) {
        return o instanceof BigDecimal d ? d : new BigDecimal(String.valueOf(o == null ? 0 : o));
    }
}
