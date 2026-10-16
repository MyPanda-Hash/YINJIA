/*
 * 只读探针(2026-10-16)⑥:scjl 全表规模与 gxdm 空值情况(判断"有报工但进度算不到"的普遍性)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-scjl-scale.java
 */
import java.sql.*;

public class _q_scjl_scale {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");
            p("\n### scjl 全表 ###");
            q(c, "SELECT COUNT(*) AS 总行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废, "
                    + "SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 未作废, "
                    + "SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(gxdm,N'')=N'' THEN 1 ELSE 0 END) AS 未作废且工序为空, "
                    + "SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(gldh,N'')=N'' THEN 1 ELSE 0 END) AS 未作废且工单号为空 "
                    + "FROM scjl");
            p("\n### 未作废且工序为空的报工明细 ###");
            q(c, "SELECT id, gldh, N'['+ISNULL(gxdm,N'')+N']' AS 工序, sl, wgzt, gd_id, [批次号] FROM scjl "
                    + "WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(gxdm,N'')=N'' ORDER BY id");
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
