// _Qry.java — 盘点生产/品质相关已注册面板(yj_panel)与菜单对应关系
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT panel_code, panel_name, category, module_group FROM yj_panel WHERE panel_code LIKE 'PR[_]%' OR panel_code LIKE 'WO[_]%' OR panel_code IN ('DAY_REPORT','FEED_CONFIRM','MIX_RECORD','GRAN_RECORD','QC_RECORD','WH_RECORD','PACK_CONFIRM','EQUIP_CHECK','MAINT_PLAN','SAMPLE_REQ','ROD_RETURN','QC_OP','QC_DISPOSAL','QC_RECV','QC_INSP','QC_RETURN','LOT_TRACE','WO_SCHEDULE','WO_KIT','WO_REPORT','WO_REPORT_LIST') ORDER BY module_group, panel_code");
      System.out.println("code | name | category | module_group");
      while (r.next()) System.out.println(r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getString(4));
    }
  }
}
