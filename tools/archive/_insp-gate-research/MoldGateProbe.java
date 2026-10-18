import java.sql.*;
import java.util.*;

/**
 * 只读探针:为《检验单生成门禁(成型完成)实现方案》量化影响面(2026-10-19)。
 *
 * <p>回答:工单行的成型完成度分布 / 三张检验单对应工单行的成型状态 / 判据取数面。
 * 全部只读,不改任何数据。计算放在 Java 侧(库内 CTE 表达式在不同账套上兼容性差)。
 *
 * <pre>
 *   cd tools
 *   "C:\Users\vigna\.jdks\ms-25.0.4\bin\java" -Dstdout.encoding=UTF-8 -cp "lib\mssql-jdbc.jar" ^
 *       archive\_insp-gate-research\MoldGateProbe.java HSDZ_MES
 * </pre>
 */
public class MoldGateProbe {

    static final String HOST = System.getenv().getOrDefault("YINJIA_SQL_HOST", "127.0.0.1");

    public static void main(String[] args) throws Exception {
        for (String db : (args.length > 0 ? args : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"})) {
            String url = "jdbc:sqlserver://" + HOST + ":1433;databaseName=" + db
                    + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
            System.out.println("==================== " + db + " ====================");
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                run(c);
            } catch (SQLException e) {
                System.out.println("[连接/执行失败] " + e.getMessage());
            }
            System.out.println();
        }
    }

    static void run(Connection c) throws SQLException {
        // ① 工单行(未作废未结案)
        List<Map<String, Object>> rows = rs(c,
                "SELECT id, pl_no, ISNULL(pl_xc,0) AS xc, ISNULL(pl_sl,0) AS pl_sl,"
              + " ISNULL([工艺路线],N'') AS route, ISNULL([批次号],N'') AS batch,"
              + " ISNULL(ja,'N') AS ja, ISNULL(asp_cancel,'N') AS cancel FROM dbo.plang ORDER BY id");
        // ② 成型已审报工量:锚行(gd_id→plang_pc.plang_id)
        Map<Long, Double> byRow = new HashMap<>();
        for (Map<String, Object> r : rs(c,
                "SELECT pc.plang_id AS rid, SUM(ISNULL(s.sl,0)) AS q FROM dbo.scjl s"
              + " JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
              + " WHERE s.gxdm = N'成型' AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.asp_cancel,'N')<>'Y'"
              + " GROUP BY pc.plang_id")) {
            byRow.put((long) num(r.get("rid")), num(r.get("q")));
        }
        // ③ 成型已审报工量:未锚行按批次兜底
        Map<String, Double> byBatch = new HashMap<>();
        for (Map<String, Object> r : rs(c,
                "SELECT ISNULL([批次号],N'') AS b, SUM(ISNULL(sl,0)) AS q FROM dbo.scjl"
              + " WHERE gxdm = N'成型' AND ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y'"
              + "   AND ISNULL(gd_id,0) = 0 GROUP BY ISNULL([批次号],N'')")) {
            byBatch.put(String.valueOf(r.get("b")), num(r.get("q")));
        }
        // ④ 路线 → 成型换算率 / 是否含成型
        Map<String, Double> moldRate = new HashMap<>();
        Set<String> moldRoutes = new HashSet<>();
        for (Map<String, Object> r : rs(c,
                "SELECT ISNULL(工艺路线编码,N'') AS route, ISNULL(换算率,1) AS rate FROM dbo.bs_route"
              + " WHERE 工序名称 = N'成型' AND ISNULL(asp_cancel,'N')<>'Y'")) {
            String route = String.valueOf(r.get("route"));
            double rate = num(r.get("rate"));
            moldRoutes.add(route);
            moldRate.put(route, rate <= 0 ? 1 : rate);
        }

        int total = 0, zero = 0, partial = 0, done = 0, noMoldRoute = 0, noRoute = 0;
        List<String> zeroSamples = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            if ("Y".equals(String.valueOf(r.get("cancel")))) continue;
            String ja = String.valueOf(r.get("ja")).trim();
            if ("Y".equals(ja) || "T".equals(ja))  { /* 结案行仍统计,单列 */ }
            total++;
            long id = (long) num(r.get("id"));
            String route = String.valueOf(r.get("route")).trim();
            String batch = String.valueOf(r.get("batch"));
            double rate = moldRate.getOrDefault(route, 1d);
            double plan = num(r.get("pl_sl")) * rate;
            double d = byRow.getOrDefault(id, 0d);
            if (d == 0 && !batch.isEmpty()) d = byBatch.getOrDefault(batch, 0d);
            if (route.isEmpty()) noRoute++;
            if (!moldRoutes.contains(route)) noMoldRoute++;
            if (d <= 0) { zero++; if (zeroSamples.size() < 8) zeroSamples.add(r.get("pl_no") + "#" + r.get("xc")); }
            else if (plan > 0 && d + 0.0001 < plan) partial++;
            else done++;
        }
        System.out.println("① 工单行(全部未作废,含已结案)" + total
                + " → 成型零报工 " + zero + " / 成型已报工但欠量 " + partial + " / 成型达标 " + done
                + " ;路线无「成型」工序 " + noMoldRoute + " (其中未绑路线 " + noRoute + ")");
        System.out.println("   成型零报工样例:" + String.join(", ", zeroSamples));

        // ⑤ 三张检验单 × 对应工单行的成型状态
        for (String[] p : new String[][]{
                {"首件检验单 QC_FIRST_INSP", "qc_first_insp_head"},
                {"制程检验单 QC_PROC_INSP", "qc_proc_insp_head"},
                {"组装成品检验单 QC_ASM_INSP", "qc_asm_insp_head"}}) {
            List<Map<String, Object>> heads = rs(c,
                    "SELECT [单据编号] AS no, ISNULL([工单号],N'') AS wo, ISNULL([工单行号],0) AS xc,"
                  + " ISNULL(asp_cancel,'N') AS cancel FROM dbo." + p[1]);
            int alive = 0, noWo = 0, moldZero = 0, moldOk = 0, noMatch = 0, noXc = 0;
            for (Map<String, Object> h : heads) {
                if ("Y".equals(String.valueOf(h.get("cancel")))) continue;
                alive++;
                String wo = String.valueOf(h.get("wo")).trim();
                int xc = (int) num(h.get("xc"));
                if (wo.isEmpty()) { noWo++; continue; }
                if (xc == 0) noXc++;
                Map<String, Object> match = null;
                for (Map<String, Object> r : rows) {
                    if (String.valueOf(r.get("pl_no")).trim().equals(wo)
                            && (int) num(r.get("xc")) == (xc == 0 ? (int) num(r.get("xc")) : xc)) { match = r; break; }
                }
                if (match == null) { noMatch++; continue; }
                long id = (long) num(match.get("id"));
                String batch = String.valueOf(match.get("batch"));
                double d = byRow.getOrDefault(id, 0d);
                if (d == 0 && !batch.isEmpty()) d = byBatch.getOrDefault(batch, 0d);
                if (d > 0) moldOk++; else moldZero++;
            }
            System.out.println("⑤ " + p[0] + " 存活 " + alive
                    + " → 对应工单行成型已报工 " + moldOk + " / 成型零报工 " + moldZero
                    + " ;无工单号 " + noWo + " ;工单号在本库查不到 " + noMatch + " ;行号=0 " + noXc);
        }

        // ⑥ 判据取数面
        for (Map<String, Object> r : rs(c,
                "SELECT ISNULL(gxdm,N'') AS op, ISNULL(wgzt,N'N') AS done, COUNT(*) AS n, SUM(ISNULL(sl,0)) AS q,"
              + " SUM(CASE WHEN ISNULL(gd_id,0)>0 THEN 1 ELSE 0 END) AS anchored FROM dbo.scjl"
              + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY gxdm, wgzt ORDER BY n DESC")) {
            System.out.println("⑥ 报工 " + r.get("op") + " 完工=" + r.get("done")
                    + " 行数=" + r.get("n") + " 数量=" + r.get("q") + " 已锚=" + r.get("anchored"));
        }
    }

    static List<Map<String, Object>> rs(Connection c, String sql) throws SQLException {
        List<Map<String, Object>> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            while (r.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= m.getColumnCount(); i++) row.put(m.getColumnLabel(i), r.getObject(i));
                out.add(row);
            }
        }
        return out;
    }

    static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
    }
}
