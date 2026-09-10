// _Qry.java — T382 台账批号查询
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT wzdm, ckdm, lot_no, rkl, ckl, yl FROM kucun WHERE wzdm = 'T382'");
      while (r.next()) System.out.println(r.getString(1) + "|" + r.getString(2) + "|" + r.getString(3) + "|" + r.getDouble(4) + "|" + r.getDouble(5) + "|" + r.getDouble(6));
    }
  }
}
