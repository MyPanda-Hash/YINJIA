// _Qry2.java — 查看 rd_plan / rd_progress 表结构 + 归档状态
import java.sql.*;
public class _Qry2 {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    for (String t : new String[]{"rd_plan", "rd_plan_detail", "rd_progress", "rd_progress_detail"}) {
      System.out.println("== " + t + " ==");
      ResultSet r = s.executeQuery("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('" + t + "') ORDER BY column_id");
      StringBuilder cols = new StringBuilder();
      while (r.next()) cols.append(r.getString(1)).append(", ");
      System.out.println("  " + cols);
      r = s.executeQuery("SELECT COUNT(*) FROM " + t);
      r.next(); System.out.println("  rows: " + r.getInt(1));
    }
    System.out.println("== RD_PLAN 已审核单据 ==");
    ResultSet r = s.executeQuery("SELECT p.doc_no, p.shr, p.shsj FROM yj_doc_status p WHERE p.panel_code = 'RD_PLAN' AND p.shr IS NOT NULL");
    while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3));
    c.close();
  }
}
