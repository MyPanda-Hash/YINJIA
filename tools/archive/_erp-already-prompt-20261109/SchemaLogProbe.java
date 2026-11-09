import java.sql.*;

/**
 * 只读:yj_schema_log 的登记情况 —— 用来判断 migrate-drop-bak-qc-snapshots-20261102.sql
 * 的闸门失败会不会把后面的迁移挡住(2026-11-09 转ERP 修复时顺带发现)。
 * 用法(在 tools 目录):java -cp lib\mssql-jdbc.jar archive\_erp-already-prompt-20261109\SchemaLogProbe.java [库名]
 */
public class SchemaLogProbe {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("== " + db);
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_schema_log")) {
                rs.next(); System.out.println("yj_schema_log 行数=" + rs.getInt(1));
            }
            System.out.println("-- 最近 12 条(applied_at 倒序)");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT TOP 12 script_name, applied_at FROM yj_schema_log ORDER BY applied_at DESC")) {
                while (rs.next()) System.out.println("  " + rs.getTimestamp(2) + "  " + rs.getString(1));
            }
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM yj_schema_log WHERE script_name LIKE '%drop-bak-qc%'")) {
                rs.next(); System.out.println("drop-bak-qc-snapshots 已登记=" + (rs.getInt(1) > 0));
            }
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM yj_schema_log WHERE script_name LIKE '%20261109%'")) {
                rs.next(); System.out.println("2026-11-09 脚本已登记数=" + rs.getInt(1));
            }
        }
    }
}
