// _rd.java — 盘点研发管理相关面板/表/数据量
import java.sql.*;
import java.nio.file.*;
public class _rd {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    sb.append("== 研发相关面板(yj_panel) ==\n");
    ResultSet r = s.executeQuery("SELECT panel_code, panel_name, mode, head_table, line_table, module_group FROM yj_panel WHERE panel_code LIKE 'RD[_]%' OR module_group = N'研发管理' ORDER BY panel_code");
    java.util.List<String[]> panels = new java.util.ArrayList<>();
    while (r.next()) {
      sb.append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | mode=").append(r.getString(3))
        .append(" | head=").append(r.getString(4)).append(" | line=").append(r.getString(5))
        .append(" | grp=").append(r.getString(6)).append("\n");
      panels.add(new String[]{r.getString(1), r.getString(4), r.getString(5)});
    }
    sb.append("\n== 各表数据量 ==\n");
    for (String[] p : panels) {
      if (p[1] != null) {
        try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM " + p[1])) { x.next();
          sb.append("  ").append(p[1]).append(": ").append(x.getInt(1)).append("\n"); }
        catch (SQLException e) { sb.append("  ").append(p[1]).append(": (无表)\n"); }
      }
      if (p[2] != null && !p[2].equals(p[1])) {
        try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM " + p[2])) { x.next();
          sb.append("  ").append(p[2]).append(": ").append(x.getInt(1)).append("\n"); }
        catch (SQLException e) { sb.append("  ").append(p[2]).append(": (无表)\n"); }
      }
    }
    sb.append("\n== yj_doc_status 中研发单据 ==\n");
    try (ResultSet x = s.executeQuery("SELECT panel_code, COUNT(*) FROM yj_doc_status WHERE panel_code LIKE 'RD[_]%' GROUP BY panel_code")) {
      while (x.next()) sb.append("  ").append(x.getString(1)).append(": ").append(x.getInt(2)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_rd-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
