// _Qry3.java — 按单据号查台账变动(查 kucun 中 T382|WH-CL|20260910001 的当前 yl)
import java.sql.*;
public class _Qry3 {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT yl FROM kucun WHERE wzdm='T382' AND ckdm='WH-CL' AND lot_no='20260910001'");
    System.out.println(r.next() ? String.valueOf(r.getDouble(1)) : "notfound");
    c.close();
  }
}
