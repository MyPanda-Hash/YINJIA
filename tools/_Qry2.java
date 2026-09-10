// _Qry2.java — 红字冲回全量核验
import java.sql.*;
public class _Qry2 {
  public static void main(String[] a) throws Exception {
    String lot = a[0];
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026"); Statement s = c.createStatement()) {
      System.out.println("== kucun lot " + lot + " ==");
      try (ResultSet r = s.executeQuery("SELECT wzdm, ckdm, rkl, ckl, yl FROM kucun WHERE lot_no = '" + lot + "'")) {
        while (r.next()) System.out.println("  " + r.getString(1) + "|" + r.getString(2) + "|rkl=" + r.getDouble(3) + "|ckl=" + r.getDouble(4) + "|yl=" + r.getDouble(5));
      }
      System.out.println("== FINISH_IN for this lot (正/红字) ==");
      try (ResultSet r = s.executeQuery("SELECT h.[单据编号], l.[实收数量], h.[备注], h.[单据状态] FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号]=l.[单据编号] WHERE l.[批号]='" + lot + "' AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY h.[id]")) {
        while (r.next()) System.out.println("  " + r.getString(1) + " qty=" + r.getDouble(2) + " | " + (r.getString(3)==null?"":r.getString(3).substring(0,Math.min(60,r.getString(3).length()))) + " | " + r.getString(4));
      }
      System.out.println("== form_flow_link (BG-49) ==");
      try (ResultSet r = s.executeQuery("SELECT source_form_no, target_form_no, link_status FROM form_flow_link WHERE source_panel_code='WO_REPORT' AND source_form_no='BG-2026-09-0049' ORDER BY id")) {
        while (r.next()) System.out.println("  " + r.getString(1) + " -> " + r.getString(2) + " [" + r.getString(3) + "]");
      }
    }
  }
}