// _golive_fix.java — 逐条执行遗漏的删除语句并报告每条真实结果
import java.sql.*;
import java.nio.file.*;
public class _golive_fix {
  public static void main(String[] args) throws Exception {
    String[][] dels = {
      {"yj_doc_status",  "DELETE FROM yj_doc_status"},
      {"yj_doc_modify_log", "DELETE FROM yj_doc_modify_log"},
      {"yj_form_approval", "DELETE FROM yj_form_approval"},
      {"yj_usage_log",   "DELETE FROM yj_usage_log"},
      {"yj_message",     "DELETE FROM yj_message"},
      {"yj_attachment",  "DELETE FROM yj_attachment"},
      {"form_flow_link", "DELETE FROM form_flow_link"},
      {"report_column_settings", "DELETE FROM report_column_settings"},
      {"s_allno",        "DELETE FROM s_allno"},
      {"yj_lot_seq",     "DELETE FROM yj_lot_seq"},
      {"qr_batch_registry", "DELETE FROM qr_batch_registry"},
      {"yj_plan_term",   "DELETE FROM yj_plan_term"},
    };
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    for (String[] d : dels) {
      try {
        int n = s.executeUpdate(d[1]);
        sb.append("OK   ").append(d[0]).append(" deleted=").append(n).append("\n");
      } catch (Exception e) {
        sb.append("FAIL ").append(d[0]).append(" :: ").append(e.getMessage()).append("\n");
      }
    }
    sb.append("== 复核 ==\n");
    for (String[] d : dels) {
      try {
        ResultSet r = s.executeQuery("SELECT COUNT(*) FROM " + d[0]);
        r.next();
        sb.append("  ").append(d[0]).append(" = ").append(r.getLong(1)).append("\n");
      } catch (Exception e) { sb.append("  ").append(d[0]).append(" ERR\n"); }
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_golive-fix-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
