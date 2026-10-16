/*
 * 只读探针:制程检验单两表的实际列数(补登记《数据库表清单》§五 用)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q_table_cols.java qc_proc_insp_head qc_proc_insp_detail
 */
import java.sql.*;

public class _q_table_cols {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== DB: " + DB + " ===");
            for (String t : a) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(?)")) {
                    ps.setString(1, t);
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        System.out.println(t + " = " + rs.getInt(1) + " cols");
                    }
                }
            }
            p("\n### 表级中文注明 ###");
            q(c, "SELECT t.name AS tbl, CAST(ep.value AS nvarchar(200)) AS note FROM sys.tables t "
                    + "LEFT JOIN sys.extended_properties ep ON ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name=N'MS_Description' "
                    + "WHERE t.name IN (N'qc_proc_insp_head', N'qc_proc_insp_detail')");
        }
    }

    static void p(String s) { System.out.println(s); }

    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    b.append(v == null ? "<null>" : String.valueOf(v).trim());
                    if (i < n) b.append(" | ");
                }
                System.out.println(b);
            }
        } catch (SQLException e) {
            System.out.println("ERR: " + e.getMessage());
        }
    }
}
