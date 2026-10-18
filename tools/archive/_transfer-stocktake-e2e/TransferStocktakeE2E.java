import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 调拨单 / 盘点单 端到端实测(2026-10-18,任务产物;只读断言 + 自清理)。
 *
 * <p>验的正是用户那句「确保单据能正常使用和修改 kucun」:
 * <ol>
 *   <li>调拨单:保存 → 审核 → kucun 调出仓减、调入仓加、**两仓合计不变** → 弃审 → 完全回滚;</li>
 *   <li>盘点单:保存 → 审核 → kucun 现存量 == 实盘数量、明细回写账面/差异 → 弃审 → 回滚到盘前;</li>
 *   <li>两张单的明细表/统计表视图可查(不 500);</li>
 *   <li>清理:删除单据 + 抹掉本脚本写下的流水与零结存行(不留测试脏数据)。</li>
 * </ol>
 *
 * <p>用法(tools 目录下):
 * <pre>java -cp "lib/mssql-jdbc.jar" archive/_transfer-stocktake-e2e/TransferStocktakeE2E.java [apiBase]</pre>
 * 默认 apiBase = http://127.0.0.1:8100(验证实例),库 = HSDZ_MES。
 */
public class TransferStocktakeE2E {

    static final String USER = "admin", PASS = "123456";
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static String base = "http://127.0.0.1:8100/api";
    static String token;
    static Connection db;
    static int pass = 0, fail = 0;
    static final List<String> cleanupDocs = new ArrayList<>();
    /** 测试"新造出来"的结存行三键(物料,仓库,批号):只在调拨目标仓原本没这一行时才记,供精确回收 */
    static String[] createdKucunKey;

    public static void main(String[] args) throws Exception {
        if (args.length > 0) base = args[0].replaceAll("/+$", "") + "/api";
        String dbName = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String dbPass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        db = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + dbName + ";encrypt=false", "yinjia", dbPass);
        System.out.println("=== 调拨单 / 盘点单 E2E @ " + base + " / " + dbName + " ===");

        login();
        transferCase();
        stocktakeCase();
        reportViewsAlive();
        cleanup();

        System.out.println();
        System.out.println("=== 汇总:PASS " + pass + " / FAIL " + fail + " ===");
        System.out.println(fail == 0 ? "RESULT: PASS" : "RESULT: FAIL-" + fail);
        System.exit(fail == 0 ? 0 : 1);
    }

    // ────────────────────────── 调拨单 ──────────────────────────
    static void transferCase() throws Exception {
        System.out.println("\n--- 1. 调拨单 TRANSFER ---");
        // 挑一行有量的库存当调出源;再挑一个不同仓库当调入目标
        Map<String, Object> src = one(
                "SELECT TOP 1 k.wzdm, k.ckdm, k.lot_no, k.yl, k.price, i.[存货名称], i.[规格型号], i.[计量单位]"
                        + " FROM kucun k LEFT JOIN bs_inv i ON i.[存货编码] = k.wzdm"
                        + " WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND k.yl >= 20 AND k.lot_no IS NOT NULL AND k.lot_no <> ''"
                        + "   AND EXISTS (SELECT 1 FROM bs_wh w WHERE w.[仓库编码] = k.ckdm AND ISNULL(w.[状态], N'启用') = N'启用')"
                        + " ORDER BY k.yl DESC");
        if (src == null) { fail("调拨:找不到 yl>=20 且有批号的库存行,无法实测"); return; }
        String item = str(src.get("wzdm")), lot = str(src.get("lot_no")), srcWh = str(src.get("ckdm"));
        double srcBefore = num(src.get("yl"));
        String dstWh = str(one("SELECT TOP 1 [仓库编码] FROM bs_wh WHERE [仓库编码] <> ? AND ISNULL([状态],N'启用')=N'启用' ORDER BY id", srcWh).get("仓库编码"));
        String dstName = str(one("SELECT TOP 1 [仓库名称] FROM bs_wh WHERE [仓库编码] = ?", dstWh).get("仓库名称"));
        String srcName = str(one("SELECT TOP 1 [仓库名称] FROM bs_wh WHERE [仓库编码] = ?", srcWh).get("仓库名称"));
        Map<String, Object> dstBeforeRow = one(
                "SELECT yl FROM kucun WHERE wzdm=? AND ckdm=? AND ((? IS NULL AND lot_no IS NULL) OR lot_no=?)",
                item, dstWh, lot, lot);
        double dstBefore = dstBeforeRow == null ? 0 : num(dstBeforeRow.get("yl"));
        if (dstBeforeRow == null) createdKucunKey = new String[]{item, dstWh, lot};   // 这行是本脚本造出来的
        System.out.printf("  场景:存货 %s / 批号 %s / 从 %s(%s) → %s(%s) / 数量 5%n",
                item, lot, srcWh, srcName, dstWh, dstName);
        System.out.printf("  调拨前:调出仓现存量=%.4f,调入仓现存量=%.4f,合计=%.4f%n",
                srcBefore, dstBefore, srcBefore + dstBefore);

        String no = saveTransfer(item, str(src.get("存货名称")), str(src.get("规格型号")),
                str(src.get("计量单位")), lot, srcWh, srcName, dstWh, dstName);
        if (no == null) return;
        check("调拨单已生成单号 " + no, no.startsWith("DB-"));

        call("TRANSFER", "审核", map("编号", no));
        double s1 = bal(item, srcWh, lot), d1 = bal(item, dstWh, lot);
        check(String.format("调出仓 %.4f → %.4f(应 -5)", srcBefore, s1), near(s1, srcBefore - 5));
        check(String.format("调入仓 %.4f → %.4f(应 +5)", dstBefore, d1), near(d1, dstBefore + 5));
        check(String.format("两仓合计守恒 %.4f == %.4f", srcBefore + dstBefore, s1 + d1),
                near(s1 + d1, srcBefore + dstBefore));
        Map<String, Object> flow = one(
                "SELECT (SELECT COUNT(*) FROM outh WHERE 单据编号=? AND src=10 AND ISNULL(asp_cancel,'N')<>'Y') AS o,"
                        + " (SELECT COUNT(*) FROM inh WHERE 单据编号=? AND src=9 AND ISNULL(asp_cancel,'N')<>'Y') AS i",
                no, no);
        check("流水两腿齐备(outh src=10 ×1,inh src=9 ×1)=" + flow, num(flow.get("o")) == 1 && num(flow.get("i")) == 1);

        call("TRANSFER", "弃审", map("编号", no));
        double s2 = bal(item, srcWh, lot), d2 = bal(item, dstWh, lot);
        check(String.format("弃审:调出仓回到 %.4f", s2), near(s2, srcBefore));
        check(String.format("弃审:调入仓回到 %.4f", d2), near(d2, dstBefore));

        // 同仓调拨必须被拒绝(业务守卫)
        String bad = saveTransfer(item, str(src.get("存货名称")), str(src.get("规格型号")),
                str(src.get("计量单位")), lot, srcWh, srcName, srcWh, srcName);
        if (bad == null) {
            check("同仓调拨被拒绝", true);
        } else {
            String err = "";
            try { call("TRANSFER", "审核", map("编号", bad)); }
            catch (RuntimeException e) { err = e.getMessage(); }
            check("同仓调拨审核被拒绝:" + err, err.contains("调出仓库 = 调入仓库") || err.contains("同仓调拨"));
        }
    }

    static String saveTransfer(String item, String name, String spec, String uom, String lot,
                               String srcWh, String srcName, String dstWh, String dstName) throws Exception {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("序号", 1);
        line.put("存货编码", item);
        line.put("存货名称", name == null ? item : name);
        line.put("规格型号", spec);
        line.put("计量单位", uom);
        line.put("批号", lot);
        line.put("调出仓库", srcName);
        line.put("调出仓库编码", srcWh);
        line.put("调入仓库", dstName);
        line.put("调入仓库编码", dstWh);
        line.put("数量", 5);
        line.put("单价", 10);
        line.put("金额", 50);
        line.put("明细备注", "E2E 调拨验证");
        Map<String, Object> fd = new LinkedHashMap<>();
        fd.put("单据日期", java.time.LocalDate.now().toString());
        fd.put("业务类型", "调拨");
        fd.put("备注", "E2E 调拨验证(脚本自清理)");
        fd.put("detail", map("items", List.of(line)));
        try {
            call("TRANSFER", "保存", fd);
        } catch (RuntimeException e) {
            fail("调拨单保存失败:" + e.getMessage());
            return null;
        }
        Map<String, Object> last = one("SELECT TOP 1 [单据编号] FROM bd_transfer ORDER BY id DESC");
        String no = last == null ? null : str(last.get("单据编号"));
        if (no != null) cleanupDocs.add(no);
        return no;
    }

    // ────────────────────────── 盘点单 ──────────────────────────
    static void stocktakeCase() throws Exception {
        System.out.println("\n--- 2. 盘点单 STOCKTAKE ---");
        Map<String, Object> src = one(
                "SELECT TOP 1 k.wzdm, k.ckdm, k.lot_no, k.yl, i.[存货名称], i.[规格型号], i.[计量单位]"
                        + " FROM kucun k LEFT JOIN bs_inv i ON i.[存货编码] = k.wzdm"
                        + " WHERE ISNULL(k.asp_cancel,'N') <> 'Y' AND k.yl >= 20 AND k.lot_no IS NOT NULL AND k.lot_no <> ''"
                        + "   AND EXISTS (SELECT 1 FROM bs_wh w WHERE w.[仓库编码] = k.ckdm AND ISNULL(w.[状态], N'启用') = N'启用')"
                        + " ORDER BY k.yl DESC");
        if (src == null) { fail("盘点:找不到可盘库存行"); return; }
        String item = str(src.get("wzdm")), lot = str(src.get("lot_no")), wh = str(src.get("ckdm"));
        double before = num(src.get("yl"));
        String whName = str(one("SELECT TOP 1 [仓库名称] FROM bs_wh WHERE [仓库编码] = ?", wh).get("仓库名称"));
        double actual = before + 7;     // 盘盈 7
        System.out.printf("  场景:存货 %s / 仓 %s(%s) / 批号 %s / 账面=%.4f → 实盘=%.4f%n",
                item, wh, whName, lot, before, actual);

        String no = saveStocktake(item, str(src.get("存货名称")), str(src.get("规格型号")),
                str(src.get("计量单位")), lot, wh, whName, actual);
        if (no == null) return;
        check("盘点单已生成单号 " + no, no.startsWith("PD-"));

        call("STOCKTAKE", "审核", map("编号", no));
        double after = bal(item, wh, lot);
        check(String.format("现存量 %.4f → %.4f(应 == 实盘 %.4f)", before, after, actual), near(after, actual));
        Map<String, Object> line = one(
                "SELECT [账面数量], [差异数量] FROM bl_stocktake WHERE [单据编号] = ?", no);
        check("明细回写 账面数量=" + line.get("账面数量") + " / 差异数量=" + line.get("差异数量"),
                near(num(line.get("账面数量")), before) && near(num(line.get("差异数量")), 7));
        Map<String, Object> flow = one(
                "SELECT COUNT(*) AS n FROM inh WHERE 单据编号 = ? AND src = 11 AND ISNULL(asp_cancel,'N') <> 'Y'", no);
        check("盘盈进 inh(src=11)×1", num(flow.get("n")) == 1);

        call("STOCKTAKE", "弃审", map("编号", no));
        double back = bal(item, wh, lot);
        check(String.format("弃审:现存量回到 %.4f", back), near(back, before));
        Map<String, Object> line2 = one("SELECT [账面数量], [差异数量] FROM bl_stocktake WHERE [单据编号] = ?", no);
        check("弃审清空 账面数量/差异数量", line2.get("账面数量") == null && line2.get("差异数量") == null);

        // 盘亏分支:实盘 = 账面 - 3
        double actual2 = before - 3;
        String no2 = saveStocktake(item, str(src.get("存货名称")), str(src.get("规格型号")),
                str(src.get("计量单位")), lot, wh, whName, actual2);
        if (no2 != null) {
            call("STOCKTAKE", "审核", map("编号", no2));
            check(String.format("盘亏:现存量 %.4f(应 == 实盘 %.4f)", bal(item, wh, lot), actual2),
                    near(bal(item, wh, lot), actual2));
            Map<String, Object> f2 = one(
                    "SELECT COUNT(*) AS n FROM outh WHERE 单据编号 = ? AND src = 12 AND ISNULL(asp_cancel,'N') <> 'Y'", no2);
            check("盘亏进 outh(src=12)×1", num(f2.get("n")) == 1);
            call("STOCKTAKE", "弃审", map("编号", no2));
            check(String.format("盘亏弃审:现存量回到 %.4f", bal(item, wh, lot)), near(bal(item, wh, lot), before));
        }
    }

    static String saveStocktake(String item, String name, String spec, String uom, String lot,
                                String wh, String whName, double actual) throws Exception {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("序号", 1);
        line.put("存货编码", item);
        line.put("存货名称", name == null ? item : name);
        line.put("规格型号", spec);
        line.put("计量单位", uom);
        line.put("批号", lot);
        line.put("仓库", whName);
        line.put("仓库编码", wh);
        line.put("实盘数量", actual);
        line.put("明细备注", "E2E 盘点验证");
        Map<String, Object> fd = new LinkedHashMap<>();
        fd.put("单据日期", java.time.LocalDate.now().toString());
        fd.put("业务类型", "盘点");
        fd.put("备注", "E2E 盘点验证(脚本自清理)");
        fd.put("detail", map("items", List.of(line)));
        try {
            call("STOCKTAKE", "保存", fd);
        } catch (RuntimeException e) {
            fail("盘点单保存失败:" + e.getMessage());
            return null;
        }
        Map<String, Object> last = one("SELECT TOP 1 [单据编号] FROM bd_stocktake ORDER BY id DESC");
        String no = last == null ? null : str(last.get("单据编号"));
        if (no != null) cleanupDocs.add(no);
        return no;
    }

    // ────────────────────────── 明细表 / 统计表视图 ──────────────────────────
    static void reportViewsAlive() throws Exception {
        System.out.println("\n--- 3. 明细表 / 统计表(flat 面板) ---");
        for (String p : List.of("TRANSFER_DETAIL", "TRANSFER_STATS", "STOCKTAKE_DETAIL", "STOCKTAKE_STATS")) {
            try {
                Map<String, Object> r = post("/px/queryFormDataList",
                        map("panelCode", p, "pageNo", 1, "pageSize", 5, "condition", Map.of()));
                check(p + " 可查询(HTTP 200)", r != null);
            } catch (RuntimeException e) {
                fail(p + " 查询失败:" + e.getMessage());
            }
        }
    }

    // ────────────────────────── 清理 ──────────────────────────
    /**
     * 清理只做三件事,**绝不按内容条件扫库**:
     * <ol>
     *   <li>按前缀把测试单分配到它自己的面板(DB- → TRANSFER / PD- → STOCKTAKE)再「删除单据」——
     *       2026-10-18 第一版把 PD 单丢给 TRANSFER 面板删,接口不校验单据归属、照样返回成功,
     *       结果 yj_doc_status 里留下一排 `TRANSFER|PD-xxx` 的垃圾行(踩坑留档);</li>
     *   <li>物理删掉本脚本写下的流水行(inh/outh,按单据编号,精确);</li>
     *   <li>把测试**新造出来**的那个调入仓结存行(0/0/0)删掉 —— 用测试开始前记下的
     *       (存货,仓库,批号) 精确三元组,不是 `rkl=0 AND ckl=0` 这种扫库条件。
     *       ⚠ 第一版就是按内容条件删的,一口气删了 261 条历史零结存行(幸好实测 `预警数量` 非 0 的行
     *         全库为 0 条,没伤到预警配置);这条注释就是防止后人再抄那种写法。</li>
     * </ol>
     */
    static void cleanup() throws Exception {
        System.out.println("\n--- 4. 清理测试数据 ---");
        for (String no : cleanupDocs) {
            String panel = no.startsWith("DB-") ? "TRANSFER" : "STOCKTAKE";
            boolean voided = false;
            try { call(panel, "删除单据", map("编号", no)); voided = true; }
            catch (RuntimeException e) { System.out.println("  作废 " + no + " 失败:" + e.getMessage()); }
            try (PreparedStatement ps = db.prepareStatement(
                    "DELETE FROM inh WHERE 单据编号 = ?; DELETE FROM outh WHERE 单据编号 = ?;")) {
                ps.setString(1, no); ps.setString(2, no); ps.executeUpdate();
            }
            System.out.println("  " + no + "(" + panel + ")" + (voided ? " 已作废" : " 作废失败(请人工处理)"));
        }
        // 精确回收:测试期间新生成的零结存结存行(只可能是"调入仓原本没有这个键"那一条)
        if (createdKucunKey != null) {
            try (PreparedStatement ps = db.prepareStatement(
                    "DELETE FROM kucun WHERE wzdm = ? AND ckdm = ? AND ((? IS NULL AND lot_no IS NULL) OR lot_no = ?)"
                            + " AND ISNULL(rkl,0) = 0 AND ISNULL(ckl,0) = 0 AND ISNULL(yl,0) = 0")) {
                ps.setString(1, createdKucunKey[0]);
                ps.setString(2, createdKucunKey[1]);
                ps.setString(3, createdKucunKey[2]);
                ps.setString(4, createdKucunKey[2]);
                int n = ps.executeUpdate();
                System.out.println("  回收测试新建的零结存行(" + String.join(" / ", createdKucunKey) + "):" + n + " 条");
            }
        }
        int left = (int) num(one("SELECT COUNT(*) AS n FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE')"
                + " AND ISNULL(canceled,'N') <> 'Y'").get("n"));
        System.out.println("  剩余未作废(按 yj_doc_status.canceled):" + left + " 张");
        check("测试单已全部作废(作废状态记在 yj_doc_status,头表 asp_cancel 不一定被写)", left == 0);
    }

    // ────────────────────────── 基建 ──────────────────────────
    static void login() throws Exception {
        String r = postRaw("/auth/login", map("userName", USER, "password", PASS));
        var m = java.util.regex.Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(r);
        if (!m.find()) throw new IllegalStateException("登录未拿到 token:" + r);
        token = m.group(1);
        System.out.println("登录成功(" + USER + ")");
    }

    static void call(String panel, String button, Map<String, Object> formData) throws Exception {
        post("/px/callButton", map("panelCode", panel, "buttonName", button,
                "formData", formData, "buttonParam", Map.of()));
    }

    static Map<String, Object> post(String path, Map<String, Object> body) throws Exception {
        String raw = postRaw(path, body);
        var c = java.util.regex.Pattern.compile("\"code\"\\s*:\\s*(-?\\d+)").matcher(raw);
        int code = c.find() ? Integer.parseInt(c.group(1)) : -1;
        if (code != 200) {
            var m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"([^\"]*)\"").matcher(raw);
            throw new IllegalStateException(m.find() ? m.group(1) : raw);
        }
        return Map.of("raw", raw);
    }

    static String postRaw(String path, Map<String, Object> body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(json(body), StandardCharsets.UTF_8));
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpResponse<String> resp = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (resp.statusCode() != 200) throw new IllegalStateException("HTTP " + resp.statusCode() + " " + resp.body());
        return resp.body();
    }

    static double bal(String item, String wh, String lot) throws Exception {
        Map<String, Object> r = one("SELECT yl FROM kucun WHERE wzdm=? AND ckdm=? AND ((? IS NULL AND lot_no IS NULL) OR lot_no=?)",
                item, wh, lot, lot);
        return r == null ? 0 : num(r.get("yl"));
    }

    static Map<String, Object> one(String sql, Object... args) throws Exception {
        try (PreparedStatement ps = db.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                Map<String, Object> m = new LinkedHashMap<>();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) m.put(rs.getMetaData().getColumnLabel(i), rs.getObject(i));
                return m;
            }
        }
    }

    static void check(String what, boolean ok) {
        if (ok) { pass++; System.out.println("  [PASS] " + what); }
        else { fail++; System.out.println("  [FAIL] " + what); }
    }
    static void fail(String what) { fail++; System.out.println("  [FAIL] " + what); }
    static boolean near(double a, double b) { return Math.abs(a - b) < 0.0001; }
    static String str(Object o) { return o == null ? null : String.valueOf(o).trim(); }
    static double num(Object o) { return o == null ? 0 : Double.parseDouble(String.valueOf(o)); }
    static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    /** 极简 JSON 序列化(只需覆盖 Map/List/String/Number/Boolean/null —— 够本脚本用)。 */
    @SuppressWarnings("unchecked")
    static String json(Object o) {
        if (o == null) return "null";
        if (o instanceof String s) return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "").replace("\t", "\\t") + "\"";
        if (o instanceof Number || o instanceof Boolean) return String.valueOf(o);
        if (o instanceof Map<?, ?> m) {
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(json(String.valueOf(e.getKey()))).append(':').append(json(e.getValue()));
            }
            return sb.append('}').toString();
        }
        if (o instanceof List<?> l) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(','); sb.append(json(l.get(i))); }
            return sb.append(']').toString();
        }
        return json(String.valueOf(o));
    }
}
