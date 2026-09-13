// _st.java — 查三张研发单据的状态行与用户 admin 标记
import java.sql.*;
import java.nio.file.*;
public class _st {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    sb.append("== yj_user ==\n");
    ResultSet r = s.executeQuery("SELECT username, real_name, is_admin, enabled FROM yj_user");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | is_admin=").append(r.getString(3)).append(" | enabled=").append(r.getString(4)).append("\n");
    sb.append("== yj_doc_status(研发三面板) ==\n");
    r = s.executeQuery("SELECT panel_code, doc_no, archived, pending, canceled, shr, modify_state, saved FROM yj_doc_status WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS') ORDER BY panel_code, doc_no");
    while (r.next()) {
      sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2))
        .append(" | archived=").append(r.getString(3)).append(" | pending=").append(r.getString(4))
        .append(" | canceled=").append(r.getString(5)).append(" | shr=").append(r.getString(6))
        .append(" | modify_state=").append(r.getString(7)).append(" | saved=").append(r.getString(8)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_st-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
