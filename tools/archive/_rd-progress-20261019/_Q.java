import java.sql.*;

/** 只读取证:RD_PROGRESS 面板元数据 + 单单据头/明细 + 单据状态。用法: java _Q.java [DB] */
public class _Q {
  static void q(Statement st, String sql) {
    System.out.println("\n== " + sql);
    try (ResultSet rs = st.executeQuery(sql)) {
      ResultSetMetaData m = rs.getMetaData();
      int n = m.getColumnCount();
      StringBuilder h = new StringBuilder();
      for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(" | ");
      System.out.println(h);
      int rows = 0;
      while (rs.next() && rows < 15) {
        StringBuilder b = new StringBuilder();
        for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(" | ");
        System.out.println(b);
        rows++;
      }
      if (rows == 0) System.out.println("(0 行)");
    } catch (Exception e) { System.out.println("[ERR] " + e.getMessage()); }
  }

  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026"); Statement st = c.createStatement()) {
      System.out.println("DB=" + db);
      q(st, "SELECT * FROM yj_panel WHERE panel_code='RD_PROGRESS'");
      q(st, "SELECT COUNT(*) AS field_cnt FROM yj_field WHERE panel_code='RD_PROGRESS'");
      q(st, "SELECT COUNT(*) AS total, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS canceled FROM rd_progress");
      q(st, "SELECT TOP 5 单据编号, 单据日期, 单据状态, asp_cancel, asp_user1 FROM rd_progress ORDER BY 单据编号 DESC");
      q(st, "SELECT COUNT(*) AS detail_cnt FROM rd_progress_detail");
      q(st, "SELECT TOP 3 * FROM yj_doc_status WHERE panel_code='RD_PROGRESS'");
    }
  }
}
