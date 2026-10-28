package com.yinjia.mes.service;

/**
 * **「生产工单行已完工 / 未完工」的唯一判定口径**(2026-10-20 收口)。
 *
 * <h3>口径</h3>
 * <pre>
 *   已完工 = plang.[完工状态] ∈ (N'生产完工', N'已完工')
 * </pre>
 * 这两列由 {@code ProcessTaskService} 在**该行全部报工达标**时置位,与「入库」和「结案」是两回事:
 * <ul>
 *   <li>入库是仓库的事 —— 生产做完了但货还没入完,{@link #done} 仍为真(见生产工单列表的「生产状态」);</li>
 *   <li>结案看 {@code plang.ja},口径在 {@link PlangClose}(外部程序也会写 ja,不能裸信)。</li>
 * </ul>
 *
 * <h3>为什么要有这个类</h3>
 * 同一句表达式此前散在 4 处(生产工单列表的内存判定、计划看板 {@code DONE_ROW}、首页流程看板、
 * 工单结案守卫),2026-10-20「首件检验单选生产工单只列未完工」又要用第 5 次 ⇒ 按《代码规范》D
 * 「禁止平行实现」收口到一处,与 {@link PlangClose} 同一个做法(SQL 侧给表达式、Java 侧给判定)。
 *
 * <p>调用方:{@code WorkOrderListController}、{@code ScheduleBoardService}、{@code FlowBoardService}、
 * {@code QcFirstInspController}(选生产工单的准入条件)。</p>
 */
public final class PlangDone {

    private PlangDone() {}

    /** 「已完工」的取值集合(历史数据里两种写法都出现过;改口径只改这一处) */
    private static final String DONE_VALUES = "N'生产完工', N'已完工'";

    /**
     * 「已完工」布尔表达式(可直接放进 WHERE / CASE WHEN)。
     * @param a 表别名(调用处 SQL 里 plang 的别名,通常是 {@code p})
     */
    public static String done(String a) {
        return "ISNULL(" + alias(a) + ".[完工状态],N'') IN (" + DONE_VALUES + ")";
    }

    /** 「未完工」布尔表达式 = NOT {@link #done}(NULL/空串一律算未完工,不会因 ISNULL 漏行) */
    public static String notDone(String a) {
        return "NOT (" + done(a) + ")";
    }

    /** 「已完工」的 Y/N 展示值(给 SELECT 列用) */
    public static String doneFlag(String a) {
        return "CASE WHEN " + done(a) + " THEN N'Y' ELSE N'N' END";
    }

    /**
     * Java 侧同一口径 —— 给已经把 {@code 完工状态} 取到内存的服务用
     * (生产工单列表算「生产状态」、选工单弹窗的行标记等)。空值/NULL 一律=false。
     */
    public static boolean isDone(Object state) {
        String v = state == null ? "" : String.valueOf(state).trim();
        return "生产完工".equals(v) || "已完工".equals(v);
    }

    private static String alias(String a) {
        return a == null || a.isBlank() ? "p" : a;
    }
}
