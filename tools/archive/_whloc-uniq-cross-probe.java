import java.sql.*;
public class _whloc_uniq_cross_probe {
  public static void main(String[] args) throws Exception {
    String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
      c.setAutoCommit(false);
      System.out.println("DB=" + db);
      try (Statement st = c.createStatement()) {
        try {
          st.executeUpdate("INSERT INTO dbo.bs_wh_loc (仓库, 仓库编码, 仓位编码, 仓位地址, asp_cancel) "
              + "SELECT TOP 1 仓库, N'ZZ-TEST', 仓位编码, 仓位地址, 'N' FROM dbo.bs_wh_loc WHERE asp_cancel='N'");
          System.out.println("PASS: same 仓位编码 in another warehouse is allowed (仓内唯一, not global)");
        } catch (SQLException e) {
          System.out.println("FAIL: cross-warehouse insert rejected -> " + e.getMessage());
        } finally {
          c.rollback();
        }
      }
    }
  }
}