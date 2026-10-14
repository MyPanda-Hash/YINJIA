/*
 * 只读探针(2026-10-14):排产落库一致性 —— 排查「排产了却在某个列表里看不到/还挂着」这一类报障。
 *   ① plang 最近 30 条改动(asp_time2 倒序):产线/改人/改时间/结案/排产量 + plang_pc 镜像行数 + 台账行数
 *   ② 已排产(scx 非空)但 **asp_time2 不是今天** 的行 ⇒ 「今日已排产」看不到(只有「全部」能看到)
 *   ③ 已排产但 **plang_pc 无镜像行** ⇒ 工单排产看板/报工锚点取不到
 *   ④ 已排产但 **wo_process_line 无台账** ⇒ 「计划线」为空、转序无依据
 *   ⑤ yj_usage_log 最近的 排产/撤销排产 留痕(panel_name 恒为「快速排产」——两条入口共用 assign,不要据此认入口)
 *   ⑥ 池口径对照:scx 空(待排产池) / scx 非空(已排产) 行数
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q_sched_state.java
 *   可加环境变量 YINJIA_SQL_DB=HSDZ_MES_TEST 切测试账套(YINJIA_SQL_PASS 改口令)。
 */
import java.sql.*;

public class _q_sched_state {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== DB: " + DB + "  now=" + now(c) + " ===");

            p("\n### ① plang 最近 30 条改动(asp_time2 倒序) ###");
            q(c, "SELECT TOP 30 p.id, p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线, ISNULL(p.asp_user2,N'') AS 改人,"
                    + " CONVERT(varchar(19), p.asp_time2, 120) AS 改时间, ISNULL(p.ja,'N') AS ja,"
                    + " ISNULL(p.pl_sl,0) AS 排产量,"
                    + " (SELECT COUNT(*) FROM plang_pc pc WHERE pc.plang_id=p.id) AS pc行,"
                    + " (SELECT COUNT(*) FROM wo_process_line w WHERE w.工单号=p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                    + "    AND (w.工单行id=p.id OR w.工单行id IS NULL)) AS 台账行"
                    + " FROM dbo.plang p WHERE p.asp_time2 IS NOT NULL AND ISNULL(p.asp_cancel,'N')<>'Y'"
                    + " ORDER BY p.asp_time2 DESC");

            p("\n### ② 已排产但 asp_time2 不是今天(今日已排产看不到) ###");
            q(c, "SELECT TOP 30 p.id, p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线,"
                    + " CONVERT(varchar(19), p.asp_time2, 120) AS 改时间, ISNULL(p.asp_user2,N'') AS 改人"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                    + "   AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
                    + "   AND (p.asp_time2 IS NULL OR CONVERT(varchar(10), p.asp_time2, 120) <> CONVERT(varchar(10), GETDATE(), 120))"
                    + " ORDER BY p.asp_time2 DESC");

            p("\n### ③ 已排产但 plang_pc 无镜像行 ###");
            q(c, "SELECT TOP 20 p.id, p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线,"
                    + " CONVERT(varchar(19), p.asp_time2, 120) AS 改时间"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                    + "   AND NOT EXISTS (SELECT 1 FROM plang_pc pc WHERE pc.plang_id=p.id)"
                    + " ORDER BY p.asp_time2 DESC");

            p("\n### ④ 已排产但 wo_process_line 无台账 ###");
            q(c, "SELECT TOP 20 p.id, p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线,"
                    + " CONVERT(varchar(19), p.asp_time2, 120) AS 改时间, ISNULL(p.[工艺路线],N'') AS 路线"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                    + "   AND NOT EXISTS (SELECT 1 FROM wo_process_line w WHERE w.工单号=p.pl_no"
                    + "        AND ISNULL(w.asp_cancel,'N')<>'Y' AND (w.工单行id=p.id OR w.工单行id IS NULL))"
                    + " ORDER BY p.asp_time2 DESC");

            p("\n### ⑤ yj_usage_log 最近 20 条 排产/撤销排产 留痕 ###");
            q(c, "SELECT TOP 20 id, user_name, panel_name, action_name, doc_no, [工单行号],"
                    + " CONVERT(varchar(19), created_at, 120) AS 时间"
                    + " FROM yj_usage_log WHERE action_name IN (N'排产', N'撤销排产') ORDER BY id DESC");

            p("\n### ⑥ 池口径对照 ###");
            q(c, "SELECT N'scx空(待排产池)' AS 口径, COUNT(*) AS 行数 FROM dbo.plang"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') NOT IN ('T','Y') AND ISNULL(scx,N'')=N''"
                    + " UNION ALL SELECT N'scx非空(已排产)', COUNT(*) FROM dbo.plang"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(scx,N'')<>N''");
        }
    }

    static String now(Connection c) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT CONVERT(varchar(19), GETDATE(), 120)")) {
            rs.next(); return rs.getString(1);
        }
    }
    static void p(String s) { System.out.println(s); }
    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    String v = rs.getString(i);
                    b.append(v == null ? "NULL" : v.trim()).append(i < n ? " | " : "");
                }
                System.out.println(b);
                rows++;
            }
            if (rows == 0) System.out.println("  (无行)");
        } catch (Exception e) {
            System.out.println("  [SQL FAIL] " + e.getMessage());
        }
    }
}
