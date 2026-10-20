package com.yinjia.mes.service;

import java.util.Map;

/**
 * **「生产状态」的唯一判定口径**(2026-10-20 收口):生产工单列表与首件检验单「选生产工单」共用。
 *
 * <h3>五态(互斥,按此顺序判)</h3>
 * <pre>
 *   未排产 = 生产线为空(还没排产入线)          —— 优先于结案:没排产的"已结案"在列表上仍按未排产看
 *   已结案 = PlangClose(ja∈T/Y 且 入库≥排产,或参考库时代号段)
 *   完工   = PlangDone(完工状态=生产完工/已完工) 或 入库数量 ≥ 排产数量(>0)
 *   在产   = 有入库但没完工
 *   未完工 = 其余(一开工记都没有)
 * </pre>
 *
 * <p><b>为什么要有这个类</b>:同一段判定原先写在 {@code WorkOrderListController.list} 的内联代码里;
 * 2026-10-20 首件检验单「选生产工单」也要显示它(用户报障:库里 {@code 完工状态} 为 NULL 时弹窗兜底显示
 * 「未开工」,与生产工单列表的「未排产」对不上)⇒ 收口到一处,两边不可能再漂移。</p>
 *
 * <p><b>注意</b>:本类只算**显示值**,不写库;入库/完工/结案各自的"是不是"仍由
 * {@link PlangDone} / {@link PlangClose} 单独回答 —— 本类只负责按上面的顺序把它们拼成一句话。</p>
 *
 * <p>另一个口径变体:排产追溯弹窗({@code ScheduleBoardService} 的「排产数据」段)只列**已排产**的行,
 * 故它没有「未排产」这一态(已结案/完工/在产/未完工);那是同一套事实的子集,不是第二份判据。</p>
 */
public final class PlangStatus {

    private PlangStatus() {}

    public static final String NOT_SCHEDULED = "未排产";
    public static final String CLOSED = "已结案";
    public static final String DONE = "完工";
    public static final String IN_PROGRESS = "在产";
    public static final String NOT_DONE = "未完工";

    /**
     * 按事实算「生产状态」。
     *
     * @param line      生产线(空 = 未排产)
     * @param closed    是否已结案({@link PlangClose};调用方传它算出的 Y/N 布尔)
     * @param doneState plang.完工状态 原值(判定见 {@link PlangDone#isDone})
     * @param schedQty  排产数量 pl_sl
     * @param inQty     入库数量 rk_sl
     */
    public static String of(String line, boolean closed, Object doneState, double schedQty, double inQty) {
        if (line == null || line.isBlank()) return NOT_SCHEDULED;
        if (closed) return CLOSED;
        if (PlangDone.isDone(doneState) || (schedQty > 0 && inQty >= schedQty)) return DONE;
        return inQty > 0 ? IN_PROGRESS : NOT_DONE;
    }

    /**
     * 行 Map 版:键与两处查询别名一致 ——
     * {@code 生产线 / 结案(Y/N,由 PlangClose.closedFlag 取) / 完工状态 / 排产数量 / 入库数量}。
     * 取不到的键按"空"处理(不抛错:这是显示口径,不该因为少一列就把列表打挂)。
     */
    public static String of(Map<String, Object> row) {
        if (row == null) return NOT_DONE;
        return of(str(row.get("生产线")), "Y".equalsIgnoreCase(str(row.get("结案"))),
                row.get("完工状态"), num(row.get("排产数量")), num(row.get("入库数量")));
    }

    private static String str(Object o) {
        if (o == null) return "";
        String s = String.valueOf(o).trim();
        return "null".equals(s) ? "" : s;
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
