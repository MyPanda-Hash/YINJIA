// _Qry.java — 移仓核验:T382 各仓台账(半成品仓 CK04 + 隔离仓 WH-GL)
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT wzdm, ckdm, lot_no, rkl, ckl, yl FROM kucun WHERE wzdm = 'T382' ORDER BY ckdm");
      while (r.next()) System.out.println(r.getString(1) + "|" + r.getString(2) + "|" + r.getString(3) + "|rkl=" + r.getDouble(4) + "|ckl=" + r.getDouble(5) + "|yl=" + r.getDouble(6));
    }
  }
}
