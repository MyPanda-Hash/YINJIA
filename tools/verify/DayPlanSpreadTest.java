import com.yinjia.mes.service.DayPlanSpread;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * DayPlanSpreadTest —— 日计划摊分纯函数验算(不碰库、直接跑)。
 *
 * <p>重点:2026-11-05 新口径 {@link DayPlanSpread#mergeReported}:
 * 报工多的就影响今天和后面、历史数据不影响、历史排产没报工的往后挤压。
 *
 * <p>跑法(仓库根目录):
 * <pre>
 *   javac -encoding UTF-8 -d .tmp/dp-test tools/verify/DayPlanSpreadTest.java \
 *       backend/src/main/java/com/yinjia/mes/service/DayPlanSpread.java
 *   java -cp .tmp/dp-test DayPlanSpreadTest
 * </pre>
 */
public class DayPlanSpreadTest {

    private static int pass = 0, fail = 0;

    public static void main(String[] args) {
        LocalDate today = LocalDate.of(2026, 11, 5);

        // 0) 纯摊分自检(整数余数逐天摊:10 件 6 天 ⇒ 2,2,2,2,1,1)
        Map<LocalDate, Double> of = DayPlanSpread.of(10, today, today.plusDays(5), today);
        check("整数余数逐天摊(10 件 6 天)", of.values().stream().mapToDouble(Double::doubleValue).sum() == 10
                && of.get(today) == 2d && of.get(today.plusDays(5)) == 1d, of.toString());

        // 1) 没报工 + 开工日=今天 ⇒ 与旧 merge 完全一致(报工不影响)
        Map<LocalDate, Double> a = DayPlanSpread.merge(104, today, today.plusDays(7), today, Map.of());
        Map<LocalDate, Double> b = DayPlanSpread.mergeReported(104, 0, today, today.plusDays(7), today, Map.of());
        check("没报工 + 开工=今天 ⇒ 与旧口径逐日一致", a.equals(b), a + " vs " + b);

        // 2) 没报工 + 开工在过去 ⇒ 历史格**不再显示计划**(否则重复计数),量全部堆积到今天~计划完工
        LocalDate startPast = today.minusDays(2);
        Map<LocalDate, Double> r2 = DayPlanSpread.mergeReported(80, 0, startPast, today.plusDays(3), today, Map.of());
        check("历史格不再显示计划(未报工的量不留在历史)",
                r2.keySet().stream().noneMatch(d -> d.isBefore(today)), r2.toString());
        check("未报工的量堆积到今天起 ⇒ 合计 = 总量 80(不会 6000 变 12000)",
                eq(sumFrom(r2, today), 80) && eq(r2.values().stream().mapToDouble(Double::doubleValue).sum(), 80),
                "all=" + r2.values().stream().mapToDouble(Double::doubleValue).sum());

        // 3) 报工多了:计划 104(13×8 天),今天已报 30 ⇒ 今天起只摊 74
        Map<LocalDate, Double> r3 = DayPlanSpread.mergeReported(104, 30, today, today.plusDays(7), today, Map.of());
        check("报工 30 / 计划 104 ⇒ 未来合计 = 74", eq(sumFrom(r3, today), 74), "future=" + sumFrom(r3, today));
        check("报工 30 ⇒ 未来按整件摊(前 2 天 10、其余 9)",
                eq(r3.get(today), 10d) && eq(r3.get(today.plusDays(1)), 10d)
                        && eq(r3.get(today.plusDays(2)), 9d) && eq(r3.get(today.plusDays(7)), 9d), r3.toString());

        // 4) 报工超过计划(现场允许超产 1%) ⇒ 未来全 0,不出现负数
        Map<LocalDate, Double> r4 = DayPlanSpread.mergeReported(104, 120, today, today.plusDays(7), today, Map.of());
        check("报工超额 ⇒ 未来合计 = 0(不出现负数)", eq(sumFrom(r4, today), 0), r4.toString());

        // 5) 未来人工指定优先:计划 104、报工 30、明天人工指定 20 ⇒ 未来合计仍 74,明天=20
        Map<LocalDate, Double> manual = new LinkedHashMap<>();
        manual.put(today.plusDays(1), 20d);
        Map<LocalDate, Double> r5 = DayPlanSpread.mergeReported(104, 30, today, today.plusDays(7), today, manual);
        check("未来人工指定优先(明天=20),其余摊 54 ⇒ 未来合计 74",
                eq(r5.get(today.plusDays(1)), 20d) && eq(sumFrom(r5, today), 74), r5.toString());

        // 6) 历史人工指定视为过期计划 ⇒ 不再显示在历史,进剩余后从今天起重摊(80 − 已报 10 = 70)
        Map<LocalDate, Double> manualPast = new LinkedHashMap<>();
        manualPast.put(today.minusDays(1), 7d);
        Map<LocalDate, Double> r6 = DayPlanSpread.mergeReported(80, 10, startPast, today.plusDays(3), today, manualPast);
        check("历史人工指定不留在历史格,剩余按今天起重摊(70)",
                r6.get(today.minusDays(1)) == null && eq(sumFrom(r6, today), 70), r6.toString());

        // 7) 没报工 + 开工在未来 ⇒ 与旧口径完全一致(没影响)
        LocalDate startFuture = today.plusDays(2);
        Map<LocalDate, Double> m7a = DayPlanSpread.merge(60, startFuture, today.plusDays(6), today, Map.of());
        Map<LocalDate, Double> m7b = DayPlanSpread.mergeReported(60, 0, startFuture, today.plusDays(6), today, Map.of());
        check("没报工 + 未开工 ⇒ 与旧口径一致", m7a.equals(m7b), m7a + " vs " + m7b);

        // 8) 用户截图场景:正常 开工日→计划完工日 区间内,过去 5 天没报工 ⇒
        //    历史格直接不显示这批计划,1000 全部堆积到今天~计划完工(5 天各 200)
        Map<LocalDate, Double> r8 = DayPlanSpread.mergeReported(1000, 0, today.minusDays(5), today.plusDays(4), today, Map.of());
        check("过去 5 天没报工 ⇒ 历史格不显示,1000 堆积到今天~完工(各 200、合计 1000)",
                r8.keySet().stream().noneMatch(d -> d.isBefore(today))
                        && eq(r8.get(today), 200d) && eq(r8.get(today.plusDays(4)), 200d)
                        && eq(r8.values().stream().mapToDouble(Double::doubleValue).sum(), 1000), r8.toString());

        // 9) 用户报障场景(截图行):计划 6000、无报工 ⇒ 不能出现"历史 6000 + 今天起 6000 = 12000"
        Map<LocalDate, Double> r9 = DayPlanSpread.mergeReported(6000, 0, today.minusDays(3), today.plusDays(2), today, Map.of());
        check("计划 6000 无报工 ⇒ 显示合计 = 6000(不是 12000)",
                eq(r9.values().stream().mapToDouble(Double::doubleValue).sum(), 6000)
                        && r9.keySet().stream().noneMatch(d -> d.isBefore(today)), r9.toString());

        System.out.println("RESULT: " + (fail == 0 ? "PASS" : "FAIL") + " (pass=" + pass + ", fail=" + fail + ")");
        if (fail > 0) System.exit(1);
    }

    private static double sumFrom(Map<LocalDate, Double> m, LocalDate from) {
        double s = 0;
        for (Map.Entry<LocalDate, Double> e : m.entrySet()) if (!e.getKey().isBefore(from)) s += e.getValue();
        return DayPlanSpread.round(s);
    }

    private static boolean eq(double a, double b) { return Math.abs(a - b) < 0.0001; }

    private static void check(String name, boolean ok, String detail) {
        System.out.println((ok ? "[PASS] " : "[FAIL] ") + name + "  " + (ok ? "" : detail));
        if (ok) pass++; else fail++;
    }
}
