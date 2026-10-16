import java.sql.*;
import java.util.*;

/** 只读探针:导出各库表清单(TSV: db<TAB>kind<TAB>name)。用法:java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_DumpTables.java */
public class _DumpTables {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            List<String> dbs = new ArrayList<>();
            try (ResultSet rs = st.executeQuery("SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name")) {
                while (rs.next()) dbs.add(rs.getString(1));
            }
            for (String db : dbs) {
                for (String kind : new String[]{"table", "view"}) {
                    String sql = "SELECT name FROM [" + db + "].sys." + kind + "s WHERE is_ms_shipped=0 ORDER BY name";
                    try (Statement s2 = c.createStatement(); ResultSet r2 = s2.executeQuery(sql)) {
                        while (r2.next()) System.out.println(db + "\t" + kind + "\t" + r2.getString(1));
                    } catch (SQLException e) { /* no access */ }
                }
            }
        }
    }
}
