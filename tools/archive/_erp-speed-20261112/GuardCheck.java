/**
 * 单元自检(2026-11-12):ErpPushGuard —— 「同一张单只许推送一次」的单号级互斥。
 *
 * 为什么要有这个自检:客户报的「点两下就生成两个入库单」= 两个并发请求都过了"是否已转ERP"的事后判据,
 * 各自向金蝶 POST 一次。这道互斥是**唯一能挡住重复入库的地方**,必须钉住三条不变式:
 *   ① 同一张单并发 30 次,只能有 **1** 次 acquire 成功(其余立即被拒,不排队);
 *   ② 不同单号互不影响(并行转不同单据是正常业务);
 *   ③ release 之后能再次 acquire(失败/超时后必须能重试,否则这张单永久推不了)。
 *
 * 运行(tools 目录下、backend 已编译):
 *   cd tools
 *   java -cp "..\backend\target\classes" archive/_erp-speed-20261112/GuardCheck.java
 */
import com.yinjia.mes.service.ErpPushGuard;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public class GuardCheck {
    private static int failed = 0;

    public static void main(String[] args) throws Exception {
        // ① 并发同一张单:只准 1 个拿到
        ErpPushGuard guard = new ErpPushGuard();
        int n = 30;
        AtomicInteger got = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        List<Thread> ts = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Thread t = new Thread(() -> {
                try { start.await(); } catch (InterruptedException ignored) { }
                Long r = guard.acquire("PURCHASE_IN|PI-2026-11-0036");
                if (r == null) got.incrementAndGet();
            });
            ts.add(t);
            t.start();
        }
        start.countDown();
        for (Thread t : ts) t.join();
        check(got.get() == 1, "① 同一张单并发 " + n + " 次,拿到占位的次数 = " + got.get() + "(必须 = 1)");
        check(guard.inFlightCount() == 1, "① 在推单数 = " + guard.inFlightCount() + "(必须 = 1)");

        // 第二次点击要拿到"已进行多久"(>= 0),而不是 null
        Long again = guard.acquire("PURCHASE_IN|PI-2026-11-0036");
        check(again != null, "① 重复点击被拒并带回已进行毫秒数:" + again);

        // ② 不同单号互不影响
        check(guard.acquire("PURCHASE_IN|PI-2026-11-0037") == null, "② 换一张单可以正常占位");
        check(guard.acquire("SALE_OUT|PI-2026-11-0036") == null, "② 不同面板同号码互不影响(键含面板)");

        // ③ release 之后可以重来
        guard.release("PURCHASE_IN|PI-2026-11-0036");
        check(guard.acquire("PURCHASE_IN|PI-2026-11-0036") == null, "③ release 之后可以再次占位(失败后能重试)");

        System.out.println(failed == 0 ? "\n[PASS] ErpPushGuard 三项不变式全部成立" : "\n[FAIL] " + failed + " 项不成立");
        if (failed != 0) System.exit(1);
    }

    private static void check(boolean ok, String what) {
        System.out.println((ok ? "  [PASS] " : "  [FAIL] ") + what);
        if (!ok) failed++;
    }
}
