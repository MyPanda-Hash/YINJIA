import java.sql.*;
public class _whloc_uniq_reject_probe {
  public static void main(String[] args) throws Exception {
    String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
      c.setAutoCommit(false);
      System.out.println("DB=" + db);
      try (Statement st = c.createStatement()) {
        try {
          st.executeUpdate("INSERT INTO dbo.bs_wh_loc (仓库, 仓库编码, 仓位编码, 仓位地址, asp_cancel) "
              + "SELECT TOP 1 仓库, 仓库编码, 仓位编码, 仓位地址, 'N' FROM dbo.bs_wh_loc WHERE asp_cancel='N'");
          System.out.println("FAIL: duplicate insert unexpectedly succeeded");
        } catch (SQLException e) {
          System.out.println("PASS: duplicate rejected -> " + e.getMessage());
        } finally {
          c.rollback();
        }
      }
    }
  }
}