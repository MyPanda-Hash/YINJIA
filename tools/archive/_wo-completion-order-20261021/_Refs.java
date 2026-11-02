import java.sql.*;
public class _Refs {
  public static void main(String[] a) throws Exception {
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
         Statement s = c.createStatement()) {
      try (ResultSet r = s.executeQuery("SELECT panel_code,col_name,label FROM yj_field WHERE ref_panel='WO_COMPLETION_LIST'")) {
        int n=0; while (r.next()) { n++; System.out.println("ref by " + r.getString(1)+"."+r.getString(2)+" ("+r.getString(3)+")"); }
        System.out.println("ref count=" + n);
      }
      try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM v_wo_completion_detail WHERE wgsj IS NULL")) {
        r.next(); System.out.println("null wgsj rows=" + r.getInt(1));
      }
      try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM v_wo_completion_detail")) {
        r.next(); System.out.println("total rows=" + r.getInt(1));
      }
    }
  }
}
