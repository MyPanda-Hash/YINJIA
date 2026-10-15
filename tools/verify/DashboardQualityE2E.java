import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.*;

/**
 * DashboardQualityE2E.java — 「我的桌面 → 质量」看板**取数口径**端到端体检
 *
 * 为什么有它(2026-10-15):字段在 2026-09-20 改过名(明细「数量」→「送检数量」、「不良数量」→「不合格数量」,
 *   见 PanelConfigService.java:1148 与 ButtonService.java:830 的注释),但 DashboardStatsService.quality()
 *   的 SQL 没跟着改,仍在 SUM(数量) / SUM(不良数量) / 按明细「日期」分趋势 —— 这三个列面板上根本
 *   没有录入入口(无 yj_field / 隐藏),于是**即使正常录检验单,质量看板也永远是 0**。
 *   本工具把「看板数字是否等于真实录入的数字」变成一条命令可验的红/绿测试。
 *
 * 口径(用户 2026-10-15 拍板):
 *   ① 总数 = SUM(送检数量);  合格 = SUM(合格数量);  非合格 = SUM(不合格数量)(不再用 total−pass,避免负数)
 *   ② 近 7 天趋势按**表头 qc_insp.单据日期**分组(不再用明细那个隐藏的「日期」列)
 *   ③ 不良物料分布 = SUM(不合格数量)(看板直接读,不改库里的计算列)
 *
 * 安全性:全部落在**测试账套 HSDZ_MES_TEST**(登录带 factory=YJ_TEST),正式库一行不动;
 *   种进去的 2 张单/3 行明细在 finally 里删干净(即使断言失败也删)。
 *
 * 用法(在 tools 目录下,需 8090 已在跑):
 *   java -cp lib\mssql-jdbc.jar verify\DashboardQualityE2E.java
 *   环境变量:YINJIA_API(默认 http://127.0.0.1:8090/api)、YINJIA_SQL_PASS
 */
public class DashboardQualityE2E {

    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String DB = "HSDZ_MES_TEST";
    static final String API = System.getenv().getOrDefault("YINJIA_API", "http://127.0.0.1:8090/api");
    static final String H1 = "ZZQC-E2E-0001";   // 单据日期 = 今天
    static final String H2 = "ZZQC-E2E-0002";   // 单据日期 = 3 天前
    static final String M_A = "E2E物料A", M_B = "E2E物料B", M_C = "E2E物料C";

    static int fail = 0;

    public static void main(String[] args) throws Exception {
        System.out.println("[目标] API " + API + "  →  账套 " + DB + "(factory=YJ_TEST)");

        try {
            seed();
            String token = loginTest();
            String json = getStats(token);
            String q = sliceQuality(json);
            System.out.println("\n[看板返回 quality] " + q);

            // ---- 期望值(与种进去的数据一一对应) ----
            int expTotal = 100 + 50 + 30;      // 送检数量
            int expPass = 90 + 50 + 20;        // 合格数量
            int expBad = 10 + 0 + 10;          // 不合格数量
            int expRate = Math.round(expPass * 100f / expTotal);

            System.out.println("\n[期望] 送检 " + expTotal + " / 合格 " + expPass + " / 不合格 " + expBad
                    + " / 合格率 " + expRate + "%");

            check("total(检验明细总数=SUM送检数量)", num(q, "total"), expTotal);
            check("pass(合格数=SUM合格数量)", num(q, "pass"), expPass);
            check("bad(非合格数=SUM不合格数量)", num(q, "bad"), expBad);
            check("passRate(合格率=合格/送检)", num(q, "passRate"), expRate);

            // ---- 趋势:按表头「单据日期」分组 ----
            List<int[]> tr = trend(q);
            if (tr.size() != 7) {
                bad("trend7 应有 7 天,实际 " + tr.size());
            } else {
                int[] today = tr.get(6);      // lastDays(7) 最后一天 = 今天
                int[] d3 = tr.get(3);         // 今天往前 3 天
                System.out.println("[趋势] 今天 added/done = " + today[0] + "/" + today[1]
                        + "   3 天前 added/done = " + d3[0] + "/" + d3[1]);
                check("trend7[今天].added(送检)", today[0], 100 + 50);
                check("trend7[今天].done(合格)", today[1], 90 + 50);
                check("trend7[3天前].added(送检)", d3[0], 30);
                check("trend7[3天前].done(合格)", d3[1], 20);
            }

            // ---- 不良物料分布:SUM(不合格数量) ----
            Map<String, Integer> di = byName(q, "defectItems");
            System.out.println("[不良物料分布] " + di);
            check("defectItems[" + M_A + "]", di.getOrDefault(M_A, 0), 10);
            check("defectItems[" + M_C + "]", di.getOrDefault(M_C, 0), 10);
            check("defectItems 里不该出现 0 不良的物料(" + M_B + ")",
                    di.containsKey(M_B) ? 1 : 0, 0);
        } finally {
            cleanup();
        }

        System.out.println();
        if (fail == 0) System.out.println("[PASS] 质量看板取数口径与真实录入一致(共 10 项断言)");
        else {
            System.out.println("[FAIL] " + fail + " 项不符 —— 看板取数口径与面板字段不一致,见上");
            System.exit(1);
        }
    }

    // ══════════════════ 种数据 / 清数据 ══════════════════

    static void seed() throws SQLException {
        try (Connection c = conn()) {
            cleanup(c);
            String ins = "INSERT INTO dbo.qc_insp (单据编号, 单据日期, 单据状态) VALUES (?, ?, N'草稿')";
            String insd = "INSERT INTO dbo.qc_insp_detail (单据编号, 物料编码, 物料名称, 送检数量, 合格数量, 不合格数量, asp_cancel)"
                    + " VALUES (?, ?, ?, ?, ?, ?, N'N')";
            try (PreparedStatement p = c.prepareStatement(ins)) {
                p.setString(1, H1); p.setDate(2, java.sql.Date.valueOf(LocalDate.now())); p.addBatch();
                p.setString(1, H2); p.setDate(2, java.sql.Date.valueOf(LocalDate.now().minusDays(3))); p.addBatch();
                p.executeBatch();
            }
            try (PreparedStatement p = c.prepareStatement(insd)) {
                Object[][] rows = {
                        {H1, "E2E-A", M_A, 100, 90, 10},
                        {H1, "E2E-B", M_B, 50, 50, 0},
                        {H2, "E2E-C", M_C, 30, 20, 10},
                };
                for (Object[] r : rows) {
                    p.setString(1, (String) r[0]); p.setString(2, (String) r[1]); p.setString(3, (String) r[2]);
                    p.setInt(4, (Integer) r[3]); p.setInt(5, (Integer) r[4]); p.setInt(6, (Integer) r[5]);
                    p.addBatch();
                }
                p.executeBatch();
            }
            System.out.println("[种数据] " + DB + ": 2 张单(今天/" + LocalDate.now().minusDays(3) + ") + 3 行明细");
        }
    }

    static void cleanup() {
        try (Connection c = conn()) { cleanup(c); System.out.println("[清数据] " + DB + " 已还原(临时单已删)"); }
        catch (Exception e) { System.err.println("[WARN] 清理失败,请手工删 " + H1 + " / " + H2 + ": " + e.getMessage()); }
    }

    static void cleanup(Connection c) throws SQLException {
        try (PreparedStatement p = c.prepareStatement(
                "DELETE FROM dbo.qc_insp_detail WHERE 单据编号 IN (?, ?)")) {
            p.setString(1, H1); p.setString(2, H2); p.executeUpdate();
        }
        try (PreparedStatement p = c.prepareStatement(
                "DELETE FROM dbo.qc_insp WHERE 单据编号 IN (?, ?)")) {
            p.setString(1, H1); p.setString(2, H2); p.executeUpdate();
        }
    }

    // ══════════════════ HTTP ══════════════════

    static String loginTest() throws Exception {
        String body = "{\"userName\":\"admin\",\"password\":\"123456\",\"factory\":\"YJ_TEST\"}";
        HttpResponse<String> r = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(API + "/auth/login"))
                        .header("Content-Type", "application/json; charset=utf-8")
                        .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        Matcher m = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"").matcher(r.body());
        if (!m.find()) throw new IllegalStateException("登录失败(测试账套): " + head(r.body(), 300));
        System.out.println("[登录] admin @ YJ_TEST  ok");
        return m.group(1);
    }

    static String getStats(String token) throws Exception {
        HttpResponse<String> r = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(API + "/dashboard/stats"))
                        .header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (r.statusCode() != 200) throw new IllegalStateException("/dashboard/stats → HTTP " + r.statusCode());
        return r.body();
    }

    /** 从整包里切出 "quality":{...} 这一段(花括号配平) */
    static String sliceQuality(String json) {
        int i = json.indexOf("\"quality\"");
        if (i < 0) throw new IllegalStateException("响应里没有 quality 段: " + head(json, 300));
        int s = json.indexOf('{', i);
        int depth = 0;
        for (int k = s; k < json.length(); k++) {
            char ch = json.charAt(k);
            if (ch == '{') depth++;
            else if (ch == '}' && --depth == 0) return json.substring(s, k + 1);
        }
        throw new IllegalStateException("quality 段括号不配平");
    }

    static Integer num(String q, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*(-?\\d+)").matcher(q);
        return m.find() ? Integer.valueOf(m.group(1)) : null;
    }

    /** trend7 → 7 组 {added,done},按数组顺序 */
    static List<int[]> trend(String q) {
        List<int[]> out = new ArrayList<>();
        Matcher m = Pattern.compile("\"added\"\\s*:\\s*(-?\\d+)\\s*,\\s*\"done\"\\s*:\\s*(-?\\d+)").matcher(q);
        while (m.find()) out.add(new int[]{Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2))});
        return out;
    }

    /** [{name,value},…] → map */
    static Map<String, Integer> byName(String q, String key) {
        Map<String, Integer> out = new LinkedHashMap<>();
        int i = q.indexOf("\"" + key + "\"");
        if (i < 0) return out;
        int s = q.indexOf('[', i), e = q.indexOf(']', s);
        if (s < 0 || e < 0) return out;
        Matcher m = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]*)\"\\s*,\\s*\"value\"\\s*:\\s*(-?\\d+)")
                .matcher(q.substring(s, e));
        while (m.find()) out.put(m.group(1), Integer.parseInt(m.group(2)));
        return out;
    }

    // ══════════════════ 断言 ══════════════════

    static void check(String what, Integer got, int want) {
        if (got != null && got == want) {
            System.out.println("  ✓ " + what + " = " + got);
        } else {
            System.out.println("  ✗ " + what + " 期望 " + want + ",实际 " + got);
            fail++;
        }
    }

    static void bad(String msg) { System.out.println("  ✗ " + msg); fail++; }

    static String head(String s, int n) { return s == null ? "null" : s.substring(0, Math.min(n, s.length())); }

    static Connection conn() throws SQLException {
        return DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB
                + ";encrypt=false;trustServerCertificate=true", USER, PASS);
    }
}
