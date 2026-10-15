import java.sql.*;
import java.util.*;

/** 只读探针:列出本实例所有库 + 各自表/视图/核心表有无。用法:java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_DbList.java */
public class _DbList {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            List<String> dbs = new ArrayList<>();
            try (ResultSet rs = st.executeQuery("SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name")) {
                while (rs.next()) dbs.add(rs.getString(1));
            }
            System.out.printf("%-28s %8s %8s %8s %8s %10s%n", "DB", "tables", "views", "yj_panel", "yj_field", "yj_schema_log");
            for (String db : dbs) {
                try (Statement s2 = c.createStatement()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append("SELECT (SELECT COUNT(*) FROM [").append(db).append("].sys.tables WHERE is_ms_shipped=0),")
                      .append("(SELECT COUNT(*) FROM [").append(db).append("].sys.views WHERE is_ms_shipped=0),")
                      .append("(SELECT COUNT(*) FROM [").append(db).append("].sys.objects WHERE name='yj_panel'),")
                      .append("(SELECT COUNT(*) FROM [").append(db).append("].sys.objects WHERE name='yj_field'),")
                      .append("(SELECT COUNT(*) FROM [").append(db).append("].sys.objects WHERE name='yj_schema_log')");
                    try (ResultSet r2 = s2.executeQuery(sb.toString())) {
                        if (r2.next()) System.out.printf("%-28s %8d %8d %8d %8d %10d%n", db,
                                r2.getInt(1), r2.getInt(2), r2.getInt(3), r2.getInt(4), r2.getInt(5));
                    }
                } catch (SQLException e) {
                    System.out.printf("%-28s  (无法统计: %s)%n", db, e.getMessage());
                }
            }
            System.out.println("\n--- 各库 yj_schema_log 行数(已登记脚本数)---");
            for (String db : dbs) {
                try (Statement s2 = c.createStatement()) {
                    try (ResultSet r2 = s2.executeQuery("SELECT COUNT(*) FROM [" + db + "].dbo.yj_schema_log")) {
                        if (r2.next()) System.out.printf("%-28s %d%n", db, r2.getInt(1));
                    }
                } catch (SQLException e) { /* no such table */ }
            }
        }
    }
}
