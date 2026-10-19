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
 *
 * <p><b>2026-10-19 收口</b>:此前"已结案"的口径散在 10 处(转领料单、切单、撤回切单、调拨、
 * 撤回调拨、待排产笔数、追溯单据状态/结案行数/子单/家族、首页流程看板),其中 5 处是**裸读 ja**
 * —— 外部把 ja 写成 Y(入库=0)时,这些动作直接报「已结案,不能…」,把业务挡住。
 * 现全部改走本类:{@link #isClosed} 给内存里的行用、{@link #anomaly} 给"异常标记"用,
 * 与 {@link #closed} **同源**,不会再出现两份判据。
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

    /**
     * **「结案异常」布尔表达式**(2026-10-19 收口)= {@code ja} 写着结案,但按上面的口径**没结案**。
     *
     * <p>为什么收口:此前有两份互相打架的判据 ——
     * <ul>
     *   <li>生产工单列表:{@code ja=Y} <b>且</b> 入库不达标 <b>且</b> 没有已审组装成品检验(两个都不成立才标);</li>
     *   <li>结案体检 / 回正 / 巡检:{@code ja=Y} 且 不同时满足(任一不成立就标)。</li>
     * </ul>
     * 实测 2026-10-19 正式库:页面标红 **19 行**、体检 **38 行** —— 点「结案回正」会连带改掉页面没标红的 19 行。
     *
     * <p>现口径只保留一条最硬的事实:**MES 两条结案路径(手工结案 / syncCloseState)都要求
     * 「入库 ≥ 排产(>0)」,所以入库没达标却写着 ja='Y' 的行,一定不是 MES 结的**。
     * 组装成品检验**不再**作为"异常"条件 —— 人工结案本来就不要求它,拿它当条件会把
     * 正经的手工结案标红,开自愈时还会把它们误回正。
     *
     * <p>写成 {@code ja∈(T,Y) AND NOT closed(a)}:与 {@link #closed} **同源**,
     * 将来 closed 的口径再动,这里自动跟着动,不会再出现两份判据。
     */
    public static String anomaly(String a) {
        return "(ISNULL(" + a + ".ja,'N') IN (N'T',N'Y') AND " + notClosed(a) + ")";
    }

    /** 「结案异常」的 Y/N 展示值(给 SELECT 列用) */
    public static String anomalyFlag(String a) {
        return "CASE WHEN " + anomaly(a) + " THEN N'Y' ELSE N'N' END";
    }

    /**
     * Java 侧同一口径 —— 给已经把 {@code ja/pl_sl/rk_sl/pl_no} 取到内存的服务用
     * (转领料单 / 切单 / 撤回切单 / 调拨 / 撤回调拨 / 手机端报工吸收)。
     *
     * <p>⚠ 这些守卫此前都是**裸读 ja**,外部把 ja 写成 Y 就报「已结案,不能…」——
     * 2026-10-19 正式库那 38 行假结案把这些动作全挡住了。
     *
     * @param ja   行上的 ja 原值(T/Y/N/NULL)
     * @param plSl 排产数量 pl_sl
     * @param rkSl 入库数量 rk_sl
     * @param plNo 工单号(参考库时代号段 GD2608* 一律算"真结案")
     */
    public static boolean isClosed(String ja, double plSl, double rkSl, String plNo) {
        String v = ja == null ? "" : ja.trim();
        boolean closed = "T".equals(v) || "Y".equals(v);
        if (!closed) return false;
        if (plNo != null && plNo.trim().startsWith(LEGACY_PREFIX)) return true;
        return plSl > 0 && rkSl + 0.0001 >= plSl;
    }

    /** Java 侧「结案异常」= 写着结案但按口径没结案(与 SQL {@link #anomaly} 同义) */
    public static boolean isAnomaly(String ja, double plSl, double rkSl, String plNo) {
        String v = ja == null ? "" : ja.trim();
        boolean closed = "T".equals(v) || "Y".equals(v);
        return closed && !isClosed(ja, plSl, rkSl, plNo);
    }
}
