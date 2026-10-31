import com.yinjia.mes.service.DayPlanSpread;

import java.time.LocalDate;
import java.util.Map;

/**
 * DayPlanSpreadTest —— 自动均摊规则的自检(2026-10-31「不需要手填,能自动算就可以了」)。
 *
 * <p>直接调用业务类 {@link DayPlanSpread}(不是复制一份公式),所以它就是那条规则的真实回归闸:
 * 以后谁改公式,这里跑不过就是改动破坏了口径。
 *
 * <p>用法(tools 目录下):
 * <pre>
 *   javac -encoding UTF-8 -cp "..\backend\target\classes" -d archive\_dayplan-auto-20261031\out archive\_dayplan-auto-20261031\SpreadTest.java
 *   java -cp "..\backend\target\classes;archive\_dayplan-auto-20261031\out" SpreadTest
 * </pre>
 */
public class SpreadTest {
    static int fail = 0;

    static void eq(String name, double want, double got) {
        boolean ok = Math.abs(want - got) < 1e-9;
        if (!ok) fail++;
        System.out.println((ok ? "[PASS] " : "[FAIL] ") + name + "  want=" + want + " got=" + got);
    }

    static void eqMap(String name, Map<LocalDate, Double> want, Map<LocalDate, Double> got) {
        StringBuilder w = new StringBuilder(), g = new StringBuilder();
        want.forEach((k, v) -> w.append(k).append(':').append(fmt(v)).append(' '));
        got.forEach((k, v) -> g.append(k).append(':').append(fmt(v)).append(' '));
        boolean ok = w.toString().trim().equals(g.toString().trim());
        if (!ok) fail++;
        System.out.println((ok ? "[PASS] " : "[FAIL] ") + name);
        if (!ok) {
            System.out.println("        want= " + w.toString().trim());
            System.out.println("        got = " + g.toString().trim());
        }
    }

    static String fmt(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(Math.round(v * 10000d) / 10000d);
    }

    static Map<LocalDate, Double> m(String... kv) {
        Map<LocalDate, Double> out = new java.util.LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) out.put(LocalDate.parse(kv[i]), Double.valueOf(kv[i + 1]));
        return out;
    }

    public static void main(String[] args) {
        LocalDate today = LocalDate.parse("2026-10-31");

        // 1. 现役真实数据:GD-2026-10-0227 行1 6000 / 开工 10-29 / 交期 10-31 ⇒ 每天 2000
        eqMap("整数件均分(6000 摊 10-29~10-31)",
                m("2026-10-29", "2000", "2026-10-30", "2000", "2026-10-31", "2000"),
                DayPlanSpread.of(6000, LocalDate.parse("2026-10-29"), today, today));

        // 2. 余数逐天摊开(不压最后一天):100 摊 10-31~11-02 ⇒ 34/33/33
        eqMap("余数逐天摊开(100 摊 3 天)",
                m("2026-10-31", "34", "2026-11-01", "33", "2026-11-02", "33"),
                DayPlanSpread.of(100, today, LocalDate.parse("2026-11-02"), today));

        // 2b. 用户 2026-10-31 现场反馈的那个格子:10 件 6 天,原实现是 1,1,1,1,1,5(压最后一天)
        //     ⇒ 应均摊成 2,2,2,2,1,1
        eqMap("均摊不倒最后一天(10 件 6 天)",
                m("2026-10-31", "2", "2026-11-01", "2", "2026-11-02", "2",
                        "2026-11-03", "2", "2026-11-04", "1", "2026-11-05", "1"),
                DayPlanSpread.of(10, today, LocalDate.parse("2026-11-05"), today));

        // 3. 无开工日 + 交期已过(现役 10 张工单都是这种)⇒ 整笔压今天
        eqMap("交期已过且无开工日 ⇒ 压今天",
                m("2026-10-31", "70"),
                DayPlanSpread.of(70, null, LocalDate.parse("2026-10-19"), today));

        // 4. 无开工日 + 未来交期 ⇒ 今天~交期
        eqMap("无开工日 ⇒ 今天起摊到交期(3000 摊 10-31~11-07)",
                m("2026-10-31", "375", "2026-11-01", "375", "2026-11-02", "375", "2026-11-03", "375",
                        "2026-11-04", "375", "2026-11-05", "375", "2026-11-06", "375", "2026-11-07", "375"),
                DayPlanSpread.of(3000, null, LocalDate.parse("2026-11-07"), today));

        // 5. 非整数(按重量):10.5 摊 3 天 ⇒ 3.5/3.5/3.5
        eqMap("非整数均分(10.5 摊 3 天)",
                m("2026-10-31", "3.5", "2026-11-01", "3.5", "2026-11-02", "3.5"),
                DayPlanSpread.of(10.5, today, LocalDate.parse("2026-11-02"), today));

        // 6. 总额不足每天 1 件:3 件摊 4 天 ⇒ 按小数均分(0.75/天),不出现"前三天 0、最后一天 3"
        eqMap("总额<天数 ⇒ 小数均分(3 摊 4 天)",
                m("2026-10-31", "0.75", "2026-11-01", "0.75", "2026-11-02", "0.75", "2026-11-03", "0.75"),
                DayPlanSpread.of(3, today, LocalDate.parse("2026-11-03"), today));

        // 7. 交期为空 ⇒ 单日
        eqMap("无交期 ⇒ 单日", m("2026-10-31", "50"), DayPlanSpread.of(50, today, null, today));

        // 8. 区间上限 60 天(老单/脏数据不把列撑爆):起点被夹到 交期-60 天
        LocalDate due = LocalDate.parse("2026-12-31");
        Map<LocalDate, Double> capped = DayPlanSpread.of(6100, LocalDate.parse("2020-01-01"), due, today);
        eq("跨度上限:天数 = 61", 61, capped.size());
        eq("跨度上限:起点 = 交期-60", 0, java.time.temporal.ChronoUnit.DAYS.between(due.minusDays(60), capped.keySet().iterator().next()));
        eq("跨度上限:合计不丢量", 6100, capped.values().stream().mapToDouble(Double::doubleValue).sum());

        // 9. 0/负数 ⇔ 无计划
        eq("total=0 ⇒ 空", 0, DayPlanSpread.of(0, today, today, today).size());
        eq("total<0 ⇒ 空", 0, DayPlanSpread.of(-5, today, today, today).size());

        // 10. on():取某一天的份额(产线「今日已排」用)
        eq("on(今天)", 2000, DayPlanSpread.on(6000, LocalDate.parse("2026-10-29"), today, today, today));
        eq("on(区间外)", 0, DayPlanSpread.on(6000, LocalDate.parse("2026-10-29"), today, LocalDate.parse("2026-11-05"), today));

        System.out.println(fail == 0 ? "\nRESULT: [PASS] 全部通过" : "\nRESULT: [FAIL] " + fail + " 项不通过");
        if (fail > 0) System.exit(1);
    }
}
