// _Qry2.java — 双出口核验
import java.sql.*;
public class _Qry2 {
  public static void main(String[] a) throws Exception {
    String bg = a[0], lot = a[1];
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026"); Statement s = c.createStatement()) {
      System.out.println("== wo_report " + bg + " ==");
      try (ResultSet r = s.executeQuery("SELECT [报工数量], [直销数量] FROM wo_report WHERE [单据编号] = N'" + bg + "'")) {
        while (r.next()) System.out.println("  qty=" + r.getDouble(1) + " dual=" + r.getDouble(2));
      }
      String fi = null;
      try (ResultSet r = s.executeQuery("SELECT target_form_no FROM form_flow_link WHERE source_panel_code = 'WO_REPORT' AND source_form_no = N'" + bg + "'")) {
        while (r.next()) fi = r.getString(1);
      }
      System.out.println("== auto FINISH_IN: " + fi + " ==");
      if (fi != null) try (ResultSet f2 = s.executeQuery("SELECT [产品编码], [实收数量], [批号], [仓库] FROM bl_finish_in WHERE [单据编号] = N'" + fi + "'")) {
        while (f2.next()) System.out.println("  row: " + f2.getString(1) + " qty=" + f2.getDouble(2) + " lot=" + f2.getString(3) + " wh=" + f2.getString(4));
      }
      System.out.println("== kucun lot " + lot + " ==");
      try (ResultSet r = s.executeQuery("SELECT wzdm, ckdm, rkl, yl FROM kucun WHERE lot_no = '" + lot + "'")) {
        while (r.next()) System.out.println("  " + r.getString(1) + "|" + r.getString(2) + "|rkl=" + r.getDouble(3) + "|yl=" + r.getDouble(4));
      }
    }
  }
}