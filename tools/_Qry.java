// _Qry.java — 台账核验(kucun 指定物料行 + PI 状态)
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT wzdm, ckdm, lot_no, rkl, ckl, yl, asp_user1 FROM kucun WHERE wzdm IN ('CL004') ORDER BY id DESC");
      while (r.next()) System.out.println("kucun: " + r.getString(1) + " | 仓=" + r.getString(2) + " | 批=" + r.getString(3) + " | rkl=" + r.getDouble(4) + " | ckl=" + r.getDouble(5) + " | yl=" + r.getDouble(6) + " | by=" + r.getString(7));
      r = s.executeQuery("SELECT doc_no, shr FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no='PI-2026-09-0004'");
      while (r.next()) System.out.println("PI状态: " + r.getString(1) + " 审核人=" + r.getString(2));
    }
  }
}
