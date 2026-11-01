package com.yinjia.mes.service;

/**
 * 「工单 → 销售订单行号」的唯一解析口径(2026-10-31,生产工单列表 / 工单追溯头共用)。
 *
 * <p><b>为什么需要单独一个类</b>:生产工单表 {@code plang} 用 {@code od_no}(订单号)+
 * {@code od_xc}(订单行 id,历史口径)回链销售订单行 —— 但 ERP 订单行**重导后 id 会变**,
 * 实测正式库 395 条有效工单行只有 128 条能按 id join 到现行 {@code bl_so_order};
 * 而「工单行号 {@code pl_xc}」自 2026-10-31 起就是订单行号、工单列表页却没有订单号列可看,
 * 所以列表/追溯都要把订单行号解析出来展示。两处若各写一套 SQL,口径必然漂移,故收口到这里。
 *
 * <p><b>三级解析(逐级降级,宁可空、不硬凑)</b>:
 * <ol>
 *   <li><b>按行 id 精确命中</b>(权威):{@code bl_so_order.id = plang.od_xc} 且同单号 ⇒
 *       取该行 {@code 行号};行号为 0/NULL 的历史行按 id 序兜底算(与转单取行号同一算法);</li>
 *   <li><b>按物料唯一对应兜底</b>(id 已过期时):同一订单号下、**与本工单物料相同**的行
 *       恰好只有 1 行 ⇒ 取它的 {@code 行号}。订单里同物料多行时无法判定,直接放弃(不猜);
 *       实测正式库剩下 267 条 100% 命中此档,且与第一档结果**0 冲突**(2026-10-31 双账套核对);</li>
 *   <li>仍解析不出 ⇒ {@code NULL}(界面显示空,不显示错误行号)。</li>
 * </ol>
 *
 * <p><b>用法</b>:调用方在 {@code FROM dbo.plang p} 之后拼 {@link #join(String)}(给出行别名),
 * 在 SELECT 里拼 {@code PlangOrderLine.expr("p") + " AS 订单行号"}。别名要求:
 * 外层工单表别名 + {@code "l"}(join 出来的销售订单行表)。
 */
public final class PlangOrderLine {

    private PlangOrderLine() {
    }

    /**
     * 解析「订单行号」需要的 LEFT JOIN 片段(跟在工单表之后;不用它的查询可只删 SELECT 表达式)。
     *
     * @param a 工单表在调用方查询里的别名(如 {@code "p"}),会被拼成 {@code a + "l"} 作为订单行表别名
     */
    public static String join(String a) {
        String l = a + "l";
        return " LEFT JOIN dbo.bl_so_order " + l + " ON " + l + ".[id] = CONVERT(bigint, ISNULL(" + a + ".od_xc, 0))"
                + "   AND " + l + ".[单据编号] = " + a + ".od_no";
    }

    /**
     * 「订单行号」表达式(SQL int;解析不出为 NULL)。需要先拼 {@link #join(String)}。
     *
     * @param a 工单表别名(与 {@link #join(String)} 保持一致)
     */
    public static String expr(String a) {
        String l = a + "l";
        return "CASE WHEN " + l + ".[id] IS NOT NULL"
                // ① 行 id 命中:用该行 行号(0/NULL 历史行按 id 序兜底)
                + " THEN CONVERT(int, ISNULL(NULLIF(" + l + ".[行号], 0), (SELECT COUNT(*) FROM dbo.bl_so_order x"
                + "   WHERE x.[单据编号]=" + l + ".[单据编号] AND ISNULL(x.asp_cancel,'N')<>'Y'"
                + "     AND x.[id]<=" + l + ".[id])))"
                // ② id 过期:同订单下「同物料且只有 1 行」时取它的行号(多行无法判定 ⇒ NULL)
                + " ELSE (SELECT TOP 1 CONVERT(int, x.[行号]) FROM dbo.bl_so_order x"
                + "   WHERE x.[单据编号]=" + a + ".od_no AND x.[存货编码]=" + a + ".dm"
                + "     AND ISNULL(x.asp_cancel,'N')<>'Y' AND ISNULL(x.[行号], 0) > 0"
                + "     AND (SELECT COUNT(*) FROM dbo.bl_so_order y WHERE y.[单据编号]=" + a + ".od_no"
                + "           AND y.[存货编码]=" + a + ".dm AND ISNULL(y.asp_cancel,'N')<>'Y') = 1"
                + "   ORDER BY x.[id]) END";
    }
}
