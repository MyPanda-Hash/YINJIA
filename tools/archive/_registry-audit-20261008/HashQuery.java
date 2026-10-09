import java.sql.*;

/** HashQuery.java — 导出 yj_schema_log 的 (script_name, content_hash) 供 _hash-drift.mjs 对账(只读) */
public class HashQuery {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    try (Connection c = DriverManager.getConnection(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
         Statement s = c.createStatement();
         ResultSet r = s.executeQuery("SELECT RTRIM(script_name), RTRIM(content_hash) FROM yj_schema_log")) {
      while (r.next()) System.out.println(r.getString(1) + "\t" + r.getString(2));
    }
  }
}
