// _Qry.java — 验证销售订单同步落库
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT 单据编号, 客户, 单据状态, 外部数据ID, asp_user1 FROM bd_so_order ORDER BY id");
      while (r.next()) System.out.println("bd_so_order: " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | ext=" + r.getString(4) + " | by=" + r.getString(5));
      r = s.executeQuery("SELECT COUNT(1) FROM bl_so_order");
      r.next(); System.out.println("bl_so_order lines: " + r.getInt(1));
      r = s.executeQuery("SELECT doc_no, shr, shsj, stopped FROM yj_doc_status WHERE panel_code='SO_ORDER' ORDER BY doc_no");
      while (r.next()) System.out.println("yj_doc_status: " + r.getString(1) + " | 审核人=" + r.getString(2) + " | " + r.getString(3) + " | stopped=" + r.getString(4));
    }
  }
}
