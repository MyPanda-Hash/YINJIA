// _refs.java — 查哪些表带 panel_code/doc_no 之类引用(清理前确认无孤儿)
import java.sql.*;
import java.nio.file.*;
public class _refs {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    sb.append("== 含 panel_code 列的表 ==\n");
    ResultSet r = s.executeQuery("SELECT DISTINCT OBJECT_NAME(object_id) FROM sys.columns WHERE name = 'panel_code' ORDER BY 1");
    while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
    sb.append("\n== 含 doc_no 列的表 ==\n");
    r = s.executeQuery("SELECT DISTINCT OBJECT_NAME(object_id) FROM sys.columns WHERE name = 'doc_no' ORDER BY 1");
    while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
    sb.append("\n== form_flow_link 中涉及三面板的行 ==\n");
    r = s.executeQuery("SELECT source_panel_code, source_form_no, target_panel_code, target_form_no FROM form_flow_link WHERE source_panel_code IN ('RD_PROGRESS','RD_APPROVAL','RD_PLAN') OR target_panel_code IN ('RD_PROGRESS','RD_APPROVAL','RD_PLAN')");
    int n = 0;
    while (r.next()) { n++; if (n <= 10) sb.append("  ").append(r.getString(1)).append("/").append(r.getString(2)).append(" -> ").append(r.getString(3)).append("/").append(r.getString(4)).append("\n"); }
    sb.append("  合计: ").append(n).append("\n");
    sb.append("\n== rd_plan 现有数据(项目名称/定级) ==\n");
    r = s.executeQuery("SELECT TOP 15 [单据编号],[项目名称],[项目定级] FROM rd_plan ORDER BY id");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | ").append(r.getString(3)).append("\n");
    sb.append("\n== rd_progress 现有数据 ==\n");
    r = s.executeQuery("SELECT TOP 5 [单据编号],[文档编号] FROM rd_progress ORDER BY id");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append("\n");
    sb.append("\n== rd_approval 现有数据 ==\n");
    r = s.executeQuery("SELECT TOP 15 [单据编号],[客户名],[文档编号] FROM rd_approval ORDER BY id");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | ").append(r.getString(3)).append("\n");
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_refs-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
