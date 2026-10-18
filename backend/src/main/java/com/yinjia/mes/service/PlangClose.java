package com.yinjia.mes.service;

/**
 * **「生产工单已结案」的唯一判定口径**(2026-10-18)。
 *
 * <h3>为什么要有这个类</h3>
 * {@code plang.ja} 这个列**不是 MES 独占的** —— 手机端小程序/参考库直连同一个库,也能直接写它。
 * 实测(2026-10-18):用户"取消结案"后扫一次码,其余工单全部变成已结案,而 MES 自己的
 * {@code yj_usage_log} 里**没有任何「结案」动作**(MES 结案必须"入库 ≥ 排产"且一定留痕)。
 * 也就是说:MES 直接信 {@code ja} 会被外部程序"带偏" —— 待排产池看不到、排产/检验单选不到,
 * 整条生产链跟着停摆。
 *
 * <h3>口径(只读判定,不改任何数据)</h3>
 * <pre>
 *   已结案 = ja ∈ ('T','Y') 且 ( 入库数量 ≥ 排产数量(>0)  或  参考库时代号段 GD2608* )
 * </pre>
 * 为什么是"入库≥排产":MES 手工结案的门槛就是它({@code WorkOrderListController.close}),
 * 自动结案({@code ProcessTaskService.syncCloseState})在它之上再加"组装成品检验已审核"。
 * 所以 **入库没达标却被写成 ja='Y' 的,一定不是 MES 结的案**。
 * {@code GD2608*} 是参考库时代真实结过的历史单(当年人工结案,没有入库口径),
 * 与 {@code migrate-plang-ja-stale-autoclose-20261015.sql} 的例外保持一致。
 *
 * <h3>用法</h3>
 * 读侧一律用 {@link #closed(String)} / {@link #notClosed(String)} 代替裸的
 * {@code ISNULL(x.ja,'N') IN ('T','Y')} —— 这样**外部程序写坏 ja 也带不偏 MES**,
 * 而且我们一个字节都不写它的数据(不影响小程序自身)。
 */
public final class PlangClose {

    private PlangClose() {}

    /** 参考库时代的历史单号段:当年真结过的单,即使没有入库也一律按"已结案"对待 */
    private static final String LEGACY_PREFIX = "GD2608";

    /**
     * 「已结案」布尔表达式(可直接放进 WHERE / CASE WHEN)。
     * @param a 表别名(调用处 SQL 里 plang 的别名,通常是 {@code p})
     */
    public static String closed(String a) {
        return "(ISNULL(" + a + ".ja,'N') IN (N'T',N'Y')"
                + " AND ((ISNULL(" + a + ".pl_sl,0) > 0 AND ISNULL(" + a + ".rk_sl,0) >= ISNULL(" + a + ".pl_sl,0))"
                + "      OR " + a + ".pl_no LIKE N'" + LEGACY_PREFIX + "%'))";
    }

    /** 「未结案」布尔表达式 = NOT {@link #closed} */
    public static String notClosed(String a) {
        return "NOT " + closed(a);
    }

    /** 「已结案」的 Y/N 展示值(给 SELECT 列用) */
    public static String closedFlag(String a) {
        return "CASE WHEN " + closed(a) + " THEN N'Y' ELSE N'N' END";
    }
}
