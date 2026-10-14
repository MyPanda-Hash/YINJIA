/*
 * 只读探针(2026-10-16)⑧:确认 scjl.gd_id 的默认值与可空性(判断 0 是否等同"未锚定")。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-gdid-default.java
 */
import java.sql.*;

public class _q_gdid_default {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");
            p("\n### scjl.gd_id 定义与默认约束 ###");
            q(c, "SELECT col.name AS 列, t.name AS 类型, col.is_nullable AS 可空, "
                    + "ISNULL(dc.definition, N'<无默认>') AS 默认值 "
                    + "FROM sys.columns col JOIN sys.types t ON t.user_type_id=col.user_type_id "
                    + "LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=col.object_id AND dc.parent_column_id=col.column_id "
                    + "WHERE col.object_id=OBJECT_ID('dbo.scjl') AND col.name IN (N'gd_id',N'工单行号',N'批次号')");
            p("\n### 同名列在 plang_pc 的定义 ###");
            q(c, "SELECT col.name AS 列, t.name AS 类型, col.is_nullable AS 可空, "
                    + "ISNULL(dc.definition, N'<无默认>') AS 默认值 "
                    + "FROM sys.columns col JOIN sys.types t ON t.user_type_id=col.user_type_id "
                    + "LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=col.object_id AND dc.parent_column_id=col.column_id "
                    + "WHERE col.object_id=OBJECT_ID('dbo.plang_pc') AND col.name IN (N'id',N'plang_id')");
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
