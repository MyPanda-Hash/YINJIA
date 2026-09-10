// _Qry.java — 修复号池:登记 SQL 直插的 GD-0003,并预留余量
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      // 直插单登记进号池(取 MAX+1 语义,登记到 0009 留余量)
      try {
        s.executeUpdate("IF NOT EXISTS (SELECT 1 FROM s_allno WHERE lb='GD' AND ny='2026-09' AND dh='GD-2026-09-0009') INSERT INTO s_allno (comm, lb, ny, dh) VALUES (0, 'GD', '2026-09', 'GD-2026-09-0009')");
        System.out.println("号池已登记 GD-2026-09-0009 (下一号 0010)");
      } catch (SQLException e) { System.out.println("号池修复: " + e.getMessage()); }
      ResultSet r = s.executeQuery("SELECT dh FROM s_allno WHERE lb='GD' AND ny='2026-09' ORDER BY dh");
      while (r.next()) System.out.println("  allno: " + r.getString(1));
    }
  }
}
