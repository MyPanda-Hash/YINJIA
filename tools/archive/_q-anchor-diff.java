/*
 * 只读探针(2026-10-16)⑨:验证 `gd_id IS NULL` 与 `ISNULL(gd_id,0)=0` 两种兜底谓词的差异
 *   —— 找出"报工在完工数据里看得见、工序进度里算不到(步骤停灰)"的行。
 * 用法: cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar archive\_q-anchor-diff.java
 */
import java.sql.*;

public class _q_anchor_diff {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");

            p("\n### ① 报工涉及但 gd_id=0 的工单在 plang 里是否存在(批次/行号) ###");
            q(c, "SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, N'['+ISNULL(p.[批次号],N'')+N']' AS 行批次, "
                    + "p.pl_sl AS 排产, ISNULL(p.[工艺路线],N'') AS 路线 "
                    + "FROM plang p WHERE p.pl_no IN (SELECT DISTINCT gldh FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' AND gd_id=0) "
                    + "AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.pl_no, p.pl_xc");

            p("\n### ② 逐报工:两种谓词各能匹配到几行 plang ###");
            q(c, "SELECT s.id, ISNULL(s.gldh,N'<null>') AS 报工工单, ISNULL(s.gxdm,N'') AS 工序, s.sl, s.gd_id, "
                    + "N'['+ISNULL(s.[批次号],N'')+N']' AS 报工批次, "
                    + "(SELECT COUNT(*) FROM plang p WHERE p.pl_no=s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y' "
                    + "   AND ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'')) AS 谓词_ISNULL0_命中行数, "
                    + "(SELECT COUNT(*) FROM plang p WHERE p.pl_no=s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y' "
                    + "   AND s.gd_id IS NULL AND ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'')) AS 谓词_ISNULL_命中行数 "
                    + "FROM scjl s WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' ORDER BY s.id");

            p("\n### ③ 会因谓词差异而\"完工数据有、工序进度无\"的报工(差异样本) ###");
            q(c, "SELECT s.id, s.gldh, s.gxdm, s.sl, s.gd_id, N'['+ISNULL(s.[批次号],N'')+N']' AS 报工批次, "
                    + "p.pl_xc AS 行号, N'['+ISNULL(p.[批次号],N'')+N']' AS 行批次, ISNULL(p.pl_sl,0) AS 行排产 "
                    + "FROM scjl s JOIN plang p ON p.pl_no=s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y' "
                    + "  AND ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'') "
                    + "WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' "
                    + "  AND ISNULL(s.gd_id,0)=0 AND s.gd_id IS NOT NULL ORDER BY s.id");
        }
    }

    static void p(String s) { System.out.println(s); }

    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    b.append(v == null ? "<null>" : String.valueOf(v).trim());
                    if (i < n) b.append(" | ");
                }
                System.out.println(b);
                rows++;
            }
            System.out.println("(" + rows + " 行)");
        } catch (SQLException e) {
            System.out.println("ERR: " + e.getMessage());
        }
    }
}
