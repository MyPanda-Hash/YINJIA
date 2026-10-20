import java.sql.*;

/** 通用只读查询: java _S [DB] "<SQL>" —— 打印结果集(最多 30 行)。 */
public class _S {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String sql = a.length > 1 ? a[1] : "SELECT 1 AS ok";
    String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026"); Statement st = c.createStatement();
         ResultSet rs = st.executeQuery(sql)) {
      ResultSetMetaData m = rs.getMetaData();
      int n = m.getColumnCount();
      StringBuilder h = new StringBuilder();
      for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(" | ");
      System.out.println(h);
      int rows = 0;
      while (rs.next() && rows < 30) {
        StringBuilder b = new StringBuilder();
        for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(" | ");
        System.out.println(b);
        rows++;
      }
      System.out.println("(" + rows + " 行)");
    }
  }
}
