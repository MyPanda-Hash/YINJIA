// _Qry.java — 停用铝业演示工序(bs_op PX 系列),保留银嘉五道
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      int n = s.executeUpdate("UPDATE bs_op SET 是否停用 = 1, 备注 = N'铝业演示工序,停用于2026-09-09' WHERE 工序编码 LIKE 'PX%'");
      System.out.println("disabled demo ops: " + n);
      ResultSet r = s.executeQuery("SELECT 工序名称, 是否停用 FROM bs_op ORDER BY id");
      while (r.next()) System.out.println("  " + r.getString(1) + (r.getBoolean(2) ? " (停用)" : ""));
    }
  }
}
