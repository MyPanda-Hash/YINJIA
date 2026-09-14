// _pnl.java — 四个辅助面板的注册(表映射)
import java.sql.*;
import java.nio.file.*;
public class _pnl {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT panel_code, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col FROM yj_panel WHERE panel_code IN ('OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','MATERIAL_OUT','PURCHASE_IN') ORDER BY panel_code");
    while (r.next()) {
      sb.append(r.getString(1)).append(" | mode=").append(r.getString(2))
        .append(" | head=").append(r.getString(3)).append(" | line=").append(r.getString(4))
        .append(" | group=").append(r.getString(5)).append(" | pk=").append(r.getString(6))
        .append(" | code=").append(r.getString(7)).append(" | prefix=").append(r.getString(8)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_pnl-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
