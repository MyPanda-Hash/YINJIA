// _flds.java — 导出辅助面板的字段注册(place 决定写头/行)
import java.sql.*;
import java.nio.file.*;
public class _flds {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT panel_code, col_name, label, place, seq FROM yj_field WHERE panel_code IN ('OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','MATERIAL_OUT','SALE_OUT') ORDER BY panel_code, seq");
    String cur = "";
    while (r.next()) {
      if (!r.getString(1).equals(cur)) { cur = r.getString(1); sb.append("== ").append(cur).append(" ==\n"); }
      sb.append("  ").append(r.getString(2)).append(" | ").append(r.getString(3)).append(" | place=").append(r.getString(4)).append(" | seq=").append(r.getString(5)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_flds-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
