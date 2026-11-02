import java.sql.*;
public class Q {
  public static void main(String[] a) throws Exception {
    String db = System.getenv().getOrDefault("YINJIA_SQL_DB","HSDZ_MES");
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false;trustServerCertificate=true";
    String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026");
    try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
      try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(a[0])) {
        ResultSetMetaData m = r.getMetaData();
        while (r.next()) {
          StringBuilder sb = new StringBuilder();
          for (int i=1;i<=m.getColumnCount();i++) sb.append(r.getString(i)).append(" | ");
          System.out.println(sb);
        }
      }
    }
  }
}
