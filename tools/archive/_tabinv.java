// _tabinv.java — 盘点 HSDZ_MES 全部表 + 现有 MS_Description 数量 → tools/archive/_tabinv-out.txt
import java.sql.*;
import java.nio.file.*;
public class _tabinv {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT t.name, CAST(ep.value AS nvarchar(500)) AS descr FROM sys.tables t LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description' ORDER BY t.name");
    int n = 0, withDesc = 0;
    while (r.next()) {
      n++;
      String d = r.getString(2);
      if (d != null && !d.isBlank()) withDesc++;
      sb.append(r.getString(1)).append("\t").append(d == null ? "" : d).append("\n");
    }
    sb.insert(0, "tables=" + n + " withDesc=" + withDesc + "\n");
    c.close();
    Files.createDirectories(Paths.get("C:/INCER/YINJIA-MES/tools/archive"));
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_tabinv-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written tables=" + n + " withDesc=" + withDesc);
  }
}
