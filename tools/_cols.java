// _cols.java — 把四个辅助单据表的列名写入 UTF-8 文件(避免控制台乱码)
import java.sql.*;
import java.nio.file.*;
public class _cols {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    for (String t : new String[]{"bl_other_in","bd_other_in","bl_other_out","bd_other_out","bl_outsource_in","bd_outsource_in","bl_outsource_issue","bd_outsource_issue"}) {
      sb.append("== ").append(t).append(" ==\n");
      ResultSet r = s.executeQuery("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('" + t + "') ORDER BY column_id");
      while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_cols-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
