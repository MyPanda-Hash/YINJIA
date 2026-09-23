package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
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
     * 启动自检:物化表与流水不一致则全量重算。
     * 必要性 —— 金蝶同步会把已审核单据直接写进 bl_(行表)与 bd_(头表),这类写入不经过 ButtonService 的
     * 审核动作,钩子不会触发,成本会静默过期。以「行数 + 数量金额合计」双指纹判断,
     * 只有真的不一致才重算(本机 235 行,毫秒级)。
     */
    public void reconcileOnStartup() {
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

    private static BigDecimal num(Object o) {
        return o instanceof BigDecimal d ? d : new BigDecimal(String.valueOf(o == null ? 0 : o));
    }
}
