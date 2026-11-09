package com.yinjia.mes.service;

/**
 * 工单行「需求占用 / 余量」的**唯一 SQL 口径**(2026-11-08 从 WorkOrderListController 抽出)。
 *
 * <p>为什么抽出来:生产工单列表与「生产工序进度看板」都要在行上显示「余量」,
 * 而余量的算法不是 `xq_sl - pl_sl` —— 它是**本工单行需求 − 本工单行被下游单据占用的合计**
 * (占用链 {@code form_flow_link},仅 {@code ACTIVE};键 = 工单号#行号,兼容历史 #行号#批次号 后缀)。
 * 两处各写一份 SQL 迟早会漂移(代码规范 D2「禁止平行实现」),故收口到这里;
 * 以后占用链口径再变,只改这一个类。
 *
 * <p>切单血缘:切单时占用链已按行拆账(WorkOrderSplitService.splitLink),
 * 所以父子两行的余量合计 = 该订单行的剩余,不会出现父/子行双双为负的旧问题(2026-10-30 修)。
 *
 * <p>用法:调用方 SQL 里工单表别名传给本类(默认 {@code p}),直接拼进 SELECT / WHERE。
 */
public final class PlangRowOccupancy {

    private PlangRowOccupancy() {
    }

    /** 别名归一(null/空白 → p),避免调用方传空串拼出 `ISNULL(.xq_sl,0)` 这种坏 SQL */
    private static String alias(String a) {
        return a == null || a.isBlank() ? "p" : a;
    }

    /**
     * 本工单行自己的订单占用合计(表达式;依赖 {@code form_flow_link})。
     *
     * @param a 工单表别名(SQL 里 plang 的别名)
     */
    public static String used(String a) {
        String p = alias(a);
        return "(SELECT SUM(l.linked_quantity) FROM form_flow_link l"
                + " WHERE l.target_panel_code='PLANG' AND l.target_form_no=" + p + ".pl_no"
                + " AND (l.target_line_key = " + p + ".pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(" + p + ".pl_xc,0))"
                + "      OR l.target_line_key LIKE " + p + ".pl_no + N'#' + CONVERT(nvarchar(20), ISNULL(" + p + ".pl_xc,0)) + N'#%')"
                + " AND l.link_status='ACTIVE')";
    }

    /**
     * 余量 = 本工单行需求 − 本工单行占用,不足 0 记 0(表达式)。
     * 显示口径与生产工单列表完全一致。
     *
     * @param a 工单表别名(与 {@link #used(String)} 保持一致)
     */
    public static String yieldOf(String a) {
        String p = alias(a);
        String used = used(p);
        return "CASE WHEN ISNULL(" + p + ".xq_sl,0) <= ISNULL(" + used + ",0)"
                + " THEN 0 ELSE ISNULL(" + p + ".xq_sl,0) - ISNULL(" + used + ",0) END";
    }
}
