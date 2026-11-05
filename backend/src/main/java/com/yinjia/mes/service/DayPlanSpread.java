package com.yinjia.mes.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 日计划「自动均摊」纯函数(2026-10-31 用户口径:**「当前不需要手填,能自动算就可以了」**)。
 *
 * <p><b>为什么是纯函数</b>:这条规则现在同时被三处消费 —— 单元格里的日计划、行上的
 * {@code 7天已排/15天已排/计划合计}、以及产线「今天已排/今日超载」。三处必须**同一把尺**,
 * 否则又会回到 2026-10-31 上午那个「格子里的数对不上汇总」的老问题。所以只在这里算一次,
 * 别处只调用;而且它是纯函数,不碰库,便于用 {@code tools/verify/DayPlanSpreadTest.java} 直接验算。
 *
 * <p><b>口径</b>(与用户 2026-10-31 选定的一致:工序计划量 ÷ 开工日→交期):
 * <ul>
 *   <li>总额 = **工序计划量** = {@code 排产数量 × 该道换算率}(与保存守卫、工序进度同一口径);</li>
 *   <li>区间 = <b>开工日 → 交期</b>;开工日为空(现役工单大量如此)⇒ 从**今天**起;交期为空 ⇒ 单日;</li>
 *   <li>交期早于起点(逾期单/脏数据)⇒ 收成**单日**(起点=今天),逾期量整笔落在今天;</li>
 *   <li>区间上限 {@link #MAX_SPAN_DAYS} 天(防老单把区间拉到半年、把列撑爆);</li>
 *   <li>整数件:每天取整,**余数逐天摊开**(前重后轻,例:10 件 6 天 ⇒ 2,2,2,2,1,1),
 *       不把余数一股脑压到最后一天(2026-10-31 用户反馈「应该是均摊而不是最后一天全部完成」);
 *       总额不足每天 1 件或非整数 ⇒ 按 4 位小数均分。</li>
 * </ul>
 *
 * <p><b>不落表</b>:日计划是**派生值**(由 排产数量/换算率/开工日/交期 决定),不再写 {@code wo_day_plan};
 * 交期或排产数量一改,下次刷新自然就变 —— 这也是「不需要手填」的含义。
 */
public final class DayPlanSpread {

    /** 单行最多摊多少天(防脏数据;正常工单 1~15 天) */
    public static final int MAX_SPAN_DAYS = 60;

    /** 4 位小数(与 plang/wo_day_plan 的 decimal 精度一致) */
    private static final double EPS = 1e-9;

    private DayPlanSpread() { }

    /**
     * 把一行的工序计划量按「开工日→交期」摊到每天。
     *
     * @param total 工序计划量(排产数量 × 换算率)
     * @param start 开工日(st_date);空 = 今天
     * @param due   交期(cp_date);空 = 单日
     * @param today 今天(由调用方传,便于测试与跨零点一致)
     * @return 日期 → 当天计划量(按日期升序;**保留 0 值**,因为日期列窗口要靠它撑开)
     */
    public static Map<LocalDate, Double> of(double total, LocalDate start, LocalDate due, LocalDate today) {
        return of(total, start, due, today, java.util.Set.of());
    }

    /**
     * 同上,但**跳过** {@code skip} 里的日期(那些天已由人工指定,自动部分不再摊到它们头上)。
     *
     * <p>这是「自动算 + 人工改一格」共存的关键:改了一格 ⇒ 剩余量只摊到**没被改过的天**
     * (2026-10-31 用户口径「剩余量重摊,总数守恒」)。
     */
    public static Map<LocalDate, Double> of(double total, LocalDate start, LocalDate due, LocalDate today,
                                            java.util.Set<LocalDate> skip) {
        Map<LocalDate, Double> out = new LinkedHashMap<>();
        if (today == null) return out;

        LocalDate s = start == null ? today : start;
        LocalDate e = due == null ? s : due;
        if (e.isBefore(s)) e = s;                                   // 逾期:整笔压到起点那天(开工日为空时即今天)
        if (ChronoUnit.DAYS.between(s, e) > MAX_SPAN_DAYS) s = e.minusDays(MAX_SPAN_DAYS);
        List<LocalDate> days = new ArrayList<>();
        for (LocalDate d = s; !d.isAfter(e); d = d.plusDays(1)) {
            if (skip == null || !skip.contains(d)) days.add(d);
        }
        int n = days.size();
        if (n == 0 || total <= 0) return out;

        double t = round(total);
        boolean wholePieces = t >= n && Math.abs(t - Math.rint(t)) < EPS;   // 整数件且够分:按件取整
        if (wholePieces) {
            long whole = Math.round(t);
            long base = whole / n;
            int rem = (int) (whole - base * n);          // 余数件数(0 ≤ rem < n)
            for (int i = 0; i < n; i++) {
                // 余数**逐天摊开**(前重后轻),不压在最后一天 ——
                // 2026-10-31 用户反馈「应该是均摊而不是最后一天全部完成」(10 件 6 天:2,2,2,2,1,1)
                long v = base + (i < rem ? 1 : 0);
                out.put(days.get(i), (double) v);
            }
        } else {
            double base = round(t / n);
            for (int i = 0; i < n; i++) {
                double v = (i == n - 1) ? round(t - base * (n - 1)) : base;
                out.put(days.get(i), v);
            }
        }
        return out;
    }

    /**
     * **合并**「人工指定」与「自动摊剩余」—— 页面/产能/汇总都走这一个出口(同一把尺)。
     *
     * <p>口径(2026-10-31 用户选定「剩余量重摊,总数守恒」):
     * <ol>
     *   <li>{@code S = Σ人工指定};</li>
     *   <li>{@code R = total − S} 摊到「区间内**没被人工指定**的天」;{@code R ≤ 0} ⇒ 不再自动摊(超分配);</li>
     *   <li>{@code 某天 = 人工值 ?? 自动值};人工指定在区间外的日期也保留(计入 S)。</li>
     * </ol>
     *
     * @param total  工序计划量
     * @param manual 人工指定(日期 → 数量);空 = 全自动
     * @return 日期 → 当天计划(按日期升序)
     */
    public static Map<LocalDate, Double> merge(double total, LocalDate start, LocalDate due, LocalDate today,
                                               Map<LocalDate, Double> manual) {
        Map<LocalDate, Double> m = manual == null ? Map.of() : manual;
        double s = 0;
        for (Double v : m.values()) if (v != null) s += v;
        Map<LocalDate, Double> out = new LinkedHashMap<>();
        out.putAll(of(round(total - s), start, due, today, m.keySet()));
        for (Map.Entry<LocalDate, Double> e : m.entrySet()) {
            if (e.getKey() != null && e.getValue() != null) out.put(e.getKey(), e.getValue());
        }
        Map<LocalDate, Double> sorted = new java.util.TreeMap<>(out);
        return new LinkedHashMap<>(sorted);
    }

    /**
     * **报工抵扣 + 未报工后移**的日计划(2026-11-05 用户口径,第二次修正)。
     *
     * <p>用户口径(原话):「当前正常开工日期到计划完工日期的排单计算……当前天数未进行报工的数量就会向后排单,
     * 而不是在之前的历史中停留,确保后面可以排完这些数量。」
     *
     * <p>规则:
     * <ol>
     *   <li><b>剩余</b> = {@code total − 已审报工 − Σ未来人工指定}(不足 0 记 0);</li>
     *   <li><b>历史日期(&lt; today)不再输出"计划"</b> —— 历史只认已审报工那本账({@code 日报工});
     *       历史排产但没报工的量全部进入"剩余",被排到今天以后(后移/挤压),确保后面能把 total 排完;</li>
     *   <li><b>今天起(或开工日,取较晚者)→ 交期</b> 摊这份剩余,再用未来的人工指定覆盖;</li>
     *   <li>完全没报工、且开工日不早于今天 ⇒ 结果与 {@link #merge} **逐日一致**(报工不影响)。</li>
     * </ol>
     *
     * <p>与 {@link #merge} 一样**总数守恒**(已报工的算作已完成):未来合计 = 剩余;
     * 报工超过总量(现场允许超产 1%)⇒ 未来全 0,不再产生负数。
     *
     * @param total    工序计划量(排产数量 × 该道换算率)
     * @param reported 该行该工序**已审报工合计**(全部日期)
     * @param start    计划开工日(空 = 今天)
     * @param due      交期/计划完工日(空 = 单日)
     * @param today    今天(由调用方传,便于测试/跨零点一致)
     * @param manual   人工指定(日期 → 数量);历史的人工指定视为已过期的计划,进剩余后重排
     * @return 日期 → 当天计划(按日期升序;**只含今天及以后**)
     */
    public static Map<LocalDate, Double> mergeReported(double total, double reported, LocalDate start, LocalDate due,
                                                        LocalDate today, Map<LocalDate, Double> manual) {
        if (today == null) return new LinkedHashMap<>();
        Map<LocalDate, Double> m = manual == null ? Map.of() : manual;
        // 未来的人工指定:优先保留,并从剩余里扣掉(历史人工指定不进未来,进剩余后重排)
        Map<LocalDate, Double> manualFuture = new java.util.LinkedHashMap<>();
        double manualFutureSum = 0;
        for (Map.Entry<LocalDate, Double> e : m.entrySet()) {
            if (e.getKey() != null && e.getValue() != null && !e.getKey().isBefore(today)) {
                manualFuture.put(e.getKey(), e.getValue());
                manualFutureSum += e.getValue();
            }
        }
        double remain = round(Math.max(0d, total - Math.max(0d, reported) - manualFutureSum));
        LocalDate s0 = start == null ? today : start;
        LocalDate spreadStart = s0.isBefore(today) ? today : s0;      // 历史已过 ⇒ 从今天起
        Map<LocalDate, Double> out = new java.util.LinkedHashMap<>();
        for (Map.Entry<LocalDate, Double> e : of(remain, spreadStart, due, today, manualFuture.keySet()).entrySet()) {
            out.put(e.getKey(), e.getValue());
        }
        out.putAll(manualFuture);
        Map<LocalDate, Double> sorted = new java.util.TreeMap<>(out);
        return new LinkedHashMap<>(sorted);
    }

    /** 人工指定合计(= S) */
    public static double manualSum(Map<LocalDate, Double> manual) {
        double s = 0;
        if (manual != null) for (Double v : manual.values()) if (v != null) s += v;
        return round(s);
    }

    /** 超分配量 = max(0, Σ人工指定 − 工序计划量);只用于提示,不拦保存(用户口径「不堵死录入」) */
    public static double overAllocated(double total, Map<LocalDate, Double> manual) {
        double over = round(manualSum(manual) - total);
        return over > 0 ? over : 0d;
    }

    /** 某一天摊到多少(产线「今天已排/今日超载」用;取不到=0) */
    public static double on(double total, LocalDate start, LocalDate due, LocalDate day, LocalDate today) {
        if (day == null) return 0d;
        Double v = of(total, start, due, today).get(day);
        return v == null ? 0d : v;
    }

    /** 4 位小数 */
    public static double round(double v) { return Math.round(v * 10000d) / 10000d; }
}
