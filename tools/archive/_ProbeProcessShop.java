import com.yinjia.mes.service.ProcessShop;

/**
 * ProcessShop 口径自检(2026-10-21 用户口径「组装和装箱工序都是同样进入组装生产线才对」)。
 *
 * 运行(在 tools 目录;需要 JDK 11+,repo 用 JAVA_HOME):
 *   javac -encoding UTF-8 -d <tmp> ..\backend\src\main\java\com\yinjia\mes\service\ProcessShop.java archive\_ProbeProcessShop.java
 *   java -cp <tmp> _ProbeProcessShop
 */
public class _ProbeProcessShop {
    private static int fail = 0;

    public static void main(String[] args) {
        // ① 装箱 → 组装:路线车间空着也能判(这就是 GD-2026-10-0202 行6 漏判的那一格)
        eq("装箱", null, "组装");
        eq("装箱", "", "组装");
        eq("装箱", "装箱", "组装");          // 路线把工序名写进车间字段
        eq("装箱", "成型", "组装");          // 路线写错车间:仍按工序归口(组装)
        // ② 组装/成型/切炭 归自己的车间
        eq("组装", null, "组装");
        eq("成型", null, "成型");
        eq("切炭", "", "切炭");
        // ③ 自定义/未知工序:沿用路线车间;路线也没有 ⇒ 不判(空)
        eq("下料", "熔铸车间", "熔铸车间");
        eq("下料", null, "");
        // ④ matches:装箱只能进组装车间下的线
        yes("装箱", null, "组装");
        no("装箱", null, "成型");
        no("装箱", null, "切炭");
        no("装箱", "装箱", "成型");
        // ⑤ 组装/成型/切炭 同理
        yes("组装", "组装", "组装");
        no("组装", "组装", "成型");
        yes("成型", "", "成型");
        no("成型", "", "组装");
        // ⑥ 判不出(未知工序 + 路线没车间)⇒ 放行,不瞎拦
        yes("下料", null, "任意线");
        yes("下料", null, null);
        // ⑦ 产线车间为空(档案没维护)⇒ 已知工序照样拦(不能当成"随便挑")
        no("装箱", null, "");
        no("装箱", null, null);

        if (fail > 0) {
            System.out.println("[FAIL] " + fail + " 断言不符");
            System.exit(1);
        }
        System.out.println("[PASS] ProcessShop 口径全部符合");
    }

    private static void eq(String op, String routeShop, String want) {
        String got = ProcessShop.resolve(op, routeShop);
        if (!want.equals(got)) {
            fail++;
            System.out.println("[FAIL] resolve(" + op + ", " + routeShop + ") = 「" + got + "」,期望「" + want + "」");
        }
    }

    private static void yes(String op, String routeShop, String lineShop) {
        if (!ProcessShop.matches(op, routeShop, lineShop)) {
            fail++;
            System.out.println("[FAIL] 应允许:" + op + " → 「" + lineShop + "」");
        }
    }

    private static void no(String op, String routeShop, String lineShop) {
        if (ProcessShop.matches(op, routeShop, lineShop)) {
            fail++;
            System.out.println("[FAIL] 应拦下:" + op + " → 「" + lineShop + "」");
        }
    }
}
