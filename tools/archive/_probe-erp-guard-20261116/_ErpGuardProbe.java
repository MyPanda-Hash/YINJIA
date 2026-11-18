import com.yinjia.mes.service.KingdeePushService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.lang.reflect.Method;
import java.util.*;

/**
 * _ErpGuardProbe.java —— 直接验证「转ERP 前置守卫」{@code KingdeePushService.assertSourceAlive} 的真实行为。
 *
 * 为什么不走点按钮:8090 里跑的是旧 jar(新代码没打包进去),而重启会打断正在用的会话。
 * 这里用反射直接调那个私有守卫方法(它在 {@code doPushDocument} 里、**任何金蝶网络调用之前**执行),
 * 于是既能验证真代码 + 真库,又绝不会把单据推到金蝶。
 *
 * 覆盖:
 *   ① 来源采购订单**没被标记** ⇒ 放行(不能有假阳性);
 *   ② 标成 'D'(金蝶已删除)    ⇒ 拒绝,消息里点名该订单 + 给出处置办法;
 *   ③ 标成 'Z'(已作废)        ⇒ 拒绝,消息写「金蝶已作废」;
 *   ④ 合单表头 "订单A、订单B"(B 已删除) ⇒ 拒绝并点名 B;
 *   ⑤ 销售出库的来源销售订单被标 'D' ⇒ 同样拒绝(同一套守卫);
 *   ⑥ 来源单号为空 ⇒ 放行(无来源单的入库单本来就能转)。
 * 结束把造出来的标记全部删掉(库不留痕)。
 *
 * 用法(在 backend 目录;classpath 见 tools/archive/_probe-erp-guard-20261116/cp.txt):
 *   javac -encoding UTF-8 -cp "target\classes;<cp>" -d ..\tools\archive\_probe-erp-guard-20261116 `
 *     ..\tools\archive\_probe-erp-guard-20261116\_ErpGuardProbe.java
 *   java -cp "target\classes;..\tools\archive\_probe-erp-guard-20261116;<cp>" _ErpGuardProbe
 */
public class _ErpGuardProbe {

    static JdbcTemplate jdbc;
    static Method guard;
    static int fails = 0;
    static final List<String[]> cleanup = new ArrayList<>();   // {panel, docNo}

    public static void main(String[] args) throws Exception {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
        jdbc = new JdbcTemplate(ds);
        KingdeePushService svc = new KingdeePushService(jdbc);
        svcHolder = svc;
        guard = KingdeePushService.class.getDeclaredMethod("assertSourceAlive",
                String.class, String.class, Map.class, List.class);
        guard.setAccessible(true);
        System.out.println("[db] 127.0.0.1/HSDZ_MES");

        // 找一张本地「采购入库单」:表头带采购订单号、来源采购订单在金蝶在册(未标记)
        Map<String, Object> pi = first("SELECT TOP 1 h.单据编号 AS no, h.采购订单号 AS po FROM bd_purchase_in h"
                + " JOIN bl_purchase_in l ON l.单据编号 = h.单据编号"
                + " WHERE ISNULL(h.采购订单号, N'') <> N'' AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                + "   AND (SELECT COUNT(*) FROM bl_purchase_in x WHERE x.单据编号 = h.单据编号"
                + "         AND ISNULL(x.asp_cancel,'N') <> 'Y') > 0"
                + " ORDER BY h.单据编号 DESC");
        if (pi == null) { System.out.println("本机库没有带采购订单号的采购入库单,无法验证"); return; }
        String piNo = str(pi.get("no"));
        String poNo = str(pi.get("po"));
        if (poNo.contains("、") || poNo.contains(",")) poNo = poNo.split("[、,，]")[0].trim();
        System.out.println("[样本] 采购入库单 " + piNo + " ← 采购订单 " + poNo);

        Map<String, Object> head = first("SELECT * FROM bd_purchase_in WHERE 单据编号 = ?", piNo);
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT * FROM bl_purchase_in WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", piNo);

        // ① 未标记 ⇒ 放行
        ok(noThrow("PURCHASE_IN", piNo, head, lines), "① 来源订单未标记时放行(无假阳性)");

        // ② 'D' ⇒ 拒绝
        mark("PU_ORDER", poNo, "D");
        String msgD = throwMsg("PURCHASE_IN", piNo, head, lines);
        ok(msgD != null && msgD.contains("金蝶已删除") && msgD.contains(poNo), "② 来源订单标 'D' 时拒绝并点名(" + brief(msgD) + ")");

        // ③ 'Z' ⇒ 拒绝
        mark("PU_ORDER", poNo, "Z");
        String msgZ = throwMsg("PURCHASE_IN", piNo, head, lines);
        ok(msgZ != null && msgZ.contains("金蝶已作废"), "③ 来源订单标 'Z' 时拒绝(金蝶已作废)");
        clear("PU_ORDER", poNo);

        // ④ 合单表头串:A(正常)、B(已删除)
        String a = poNo, b = poNo + "-合单B";
        mark("PU_ORDER", b, "D");
        Map<String, Object> headMulti = new HashMap<>(head);
        headMulti.put("采购订单号", a + "、" + b);
        String msgMulti = throwMsg("PURCHASE_IN", piNo, headMulti, lines);
        ok(msgMulti != null && msgMulti.contains(b), "④ 合单串里只有被删的那张会被点名(" + brief(msgMulti) + ")");
        clear("PU_ORDER", b);

        // ⑤ 销售出库的来源销售订单被标 'D'
        String soNo = "TESTSO-GUARD-1";
        mark("SO_ORDER", soNo, "D");
        Map<String, Object> headSo = new HashMap<>();
        headSo.put("销售订单号", soNo);
        String msgSo = throwMsg("SALE_OUT", "TESTSALE-1", headSo, List.of(Map.of("单据编号", "TESTSALE-1")));
        ok(msgSo != null && msgSo.contains(soNo) && msgSo.contains("销售订单"), "⑤ 销售出库的来源销售订单被删同样被拒");
        clear("SO_ORDER", soNo);

        // ⑥ 无来源单号 ⇒ 放行(MES 自建入库单本来就能转)
        Map<String, Object> headNone = new HashMap<>();
        headNone.put("采购订单号", "");
        ok(noThrow("PURCHASE_IN", piNo, headNone, lines), "⑥ 表头/行都没来源单号时放行");

        cleanupAll();
        System.out.println(fails == 0 ? "\n[PASS] 转ERP 前置守卫 6 项全通过" : "\n[FAIL] " + fails + " 项");
        if (fails > 0) System.exit(1);
    }

    // ── 调用守卫 ──────────────────────────────────────────────
    static String throwMsg(String panel, String no, Map<String, Object> head, List<Map<String, Object>> lines) {
        try { guard.invoke(svcHolder, panel, no, head, lines); return null; }
        catch (java.lang.reflect.InvocationTargetException e) { return String.valueOf(e.getCause().getMessage()); }
        catch (Exception e) { return "reflect:" + e.getMessage(); }
    }
    static boolean noThrow(String panel, String no, Map<String, Object> head, List<Map<String, Object>> lines) {
        return throwMsg(panel, no, head, lines) == null;
    }
    static KingdeePushService svcHolder;

    static void ok(boolean c, String m) {
        System.out.println((c ? "  ✓ " : "  ✗ ") + m);
        if (!c) fails++;
    }
    static String brief(String s) { return s == null ? "null" : (s.length() > 60 ? s.substring(0, 60) + "…" : s); }

    // ── 造标记 / 清理 ─────────────────────────────────────────
    /** 造标记前先记原值(原本没这行 = null):跑完一定要还原,否则会把真单据留在"金蝶已作废"状态 */
    static final Map<String, String> existedBefore = new LinkedHashMap<>();

    static void mark(String panel, String docNo, String kind) {
        if (docNo == null || docNo.isBlank()) return;
        String key = panel + "|" + docNo;
        if (!existedBefore.containsKey(key)) {
            List<Map<String, Object>> rs = jdbc.queryForList(
                    "SELECT ISNULL(erp_close_state, N'') AS ecs FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?",
                    panel, docNo);
            existedBefore.put(key, rs.isEmpty() ? null : str(rs.get(0).get("ecs")));
        }
        jdbc.update("IF NOT EXISTS (SELECT 1 FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?)"
                + " INSERT INTO yj_doc_status (panel_code, doc_no, canceled, stopped, erp_close_state, pending, update_at)"
                + " VALUES (?, ?, N'N', N'N', ?, N'N', GETDATE())", panel, docNo, panel, docNo, kind);
        jdbc.update("UPDATE yj_doc_status SET erp_close_state = ? WHERE panel_code = ? AND doc_no = ?", kind, panel, docNo);
        cleanup.add(new String[]{panel, docNo});
    }
    static void clear(String panel, String docNo) {
        restore(panel, docNo);
    }

    /** 还原:原本没这行 → 删掉;原本有 → erp_close_state 写回原值 */
    static void restore(String panel, String docNo) {
        String prev = existedBefore.get(panel + "|" + docNo);
        if (prev == null) {
            jdbc.update("DELETE FROM yj_doc_status WHERE panel_code = ? AND doc_no = ?", panel, docNo);
        } else if (prev.isEmpty()) {
            jdbc.update("UPDATE yj_doc_status SET erp_close_state = NULL WHERE panel_code = ? AND doc_no = ?", panel, docNo);
        } else {
            jdbc.update("UPDATE yj_doc_status SET erp_close_state = ? WHERE panel_code = ? AND doc_no = ?", prev, panel, docNo);
        }
    }
    static void cleanupAll() {
        Set<String> done = new LinkedHashSet<>();
        for (String[] c : cleanup) {
            if (!done.add(c[0] + "|" + c[1])) continue;
            restore(c[0], c[1]);
        }
        System.out.println("  · 已把本次造出来的标记还原(原本没有的行已删除)");
    }
    static Map<String, Object> first(String sql, Object... args) {
        List<Map<String, Object>> rs = args.length == 0 ? jdbc.queryForList(sql) : jdbc.queryForList(sql, args);
        return rs.isEmpty() ? null : rs.get(0);
    }
    static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
}
