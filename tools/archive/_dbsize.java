// _dbsize.java — HSDZ_MES 库大小/文件路径/兼容级别 → tools/archive/_dbsize-out.txt
import java.sql.*;
import java.nio.file.*;
public class _dbsize {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT name, size * 8 / 1024 AS size_mb, physical_name, type_desc FROM sys.database_files");
    long total = 0;
    while (r.next()) {
      total += r.getLong(2);
      sb.append(r.getString(1)).append(" | ").append(r.getString(4)).append(" | ").append(r.getLong(2)).append(" MB | ").append(r.getString(3)).append("\n");
    }
    sb.insert(0, "文件总大小: " + total + " MB\n");
    r = s.executeQuery("SELECT SUM(reserved_page_count) * 8 / 1024 FROM sys.dm_db_partition_stats");
    if (r.next()) sb.insert(0, "对象占用约: " + r.getLong(1) + " MB\n");
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_dbsize-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
