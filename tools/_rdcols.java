// _rdcols.java — 导出三面板头/行表列名与字段注册
import java.sql.*;
import java.nio.file.*;
public class _rdcols {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    for (String t : new String[]{"rd_approval","rd_approval_detail","rd_plan","rd_progress","rd_progress_detail"}) {
      sb.append("== ").append(t).append(" ==\n");
      ResultSet r = s.executeQuery("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('" + t + "') ORDER BY column_id");
      while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
    }
    sb.append("\n== 字段注册(place=query 的即列表页/参照可见列) ==\n");
    ResultSet r = s.executeQuery("SELECT panel_code, col_name, label, place, required, data_type FROM yj_field WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS') ORDER BY panel_code, seq");
    String cur = "";
    while (r.next()) {
      if (!r.getString(1).equals(cur)) { cur = r.getString(1); sb.append("== ").append(cur).append(" ==\n"); }
      sb.append("  ").append(r.getString(2)).append(" | ").append(r.getString(3))
        .append(" | place=").append(r.getString(4)).append(" | req=").append(r.getString(5))
        .append(" | type=").append(r.getString(6)).append("\n");
    }
    sb.append("\n== 面板注册(prefix/pk/group) ==\n");
    r = s.executeQuery("SELECT panel_code, prefix, code_col, group_col, pk_col, date_col FROM yj_panel WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS')");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | prefix=").append(r.getString(2))
      .append(" | code=").append(r.getString(3)).append(" | group=").append(r.getString(4))
      .append(" | pk=").append(r.getString(5)).append(" | date=").append(r.getString(6)).append("\n");
    sb.append("\n== s_allno 号池(三前缀) ==\n");
    r = s.executeQuery("SELECT lb, ny, dh FROM s_allno WHERE lb IN ('LXA','LXB','LXJ') ORDER BY lb, ny");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | ").append(r.getString(3)).append("\n");
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_rdcols-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
