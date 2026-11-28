import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/**
 * 造数/清理:测试账套(HSDZ_MES_TEST)给 YJ-XH-001 在 YCL-01 造 3 个真实批号 + PC0000 的库存,
 * 用来验证「扫码出库 · 批次勾选 + PC0000 最前 + 按序扣减」。
 *
 * <p>参数:seed = 造数;clean = 清回 0(只动这 4 行,别的行不碰)。
 */
public class q6 {
  public static void main(String[] a) throws Exception {
    String mode = a.length > 0 ? a[0] : "seed";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=8";
    StringBuilder sb = new StringBuilder();
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
      c.setAutoCommit(false);
      if ("seed".equals(mode)) {
        // 三个真实批号:0904=20 / 0914=30 / 1014=40(合计 90);PC0000 单独 10
        try (PreparedStatement ps = c.prepareStatement(
            "UPDATE dbo.kucun SET yl = ? WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no)=?")) {
          Object[][] rows = { { 20.0, "XH-20260904" }, { 30.0, "XH-20260914" }, { 40.0, "XH-20261014" } };
          for (Object[] r : rows) {
            ps.setDouble(1, (Double) r[0]);
            ps.setString(2, (String) r[1]);
            sb.append("update ").append(r[1]).append(" -> ").append(ps.executeUpdate()).append(" 行\n");
          }
        }
        // PC0000 行:有就更新现存量,没有就复制一行出来
        try (PreparedStatement ps = c.prepareStatement(
            "UPDATE dbo.kucun SET yl = 10.0 WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no)='PC0000'")) {
          int n = ps.executeUpdate();
          sb.append("update PC0000 -> ").append(n).append(" 行\n");
          if (n == 0) {
            try (PreparedStatement ins = c.prepareStatement(
                "INSERT INTO dbo.kucun (wzdm, lot_no, ckdm, yl, rkl, ckl, in_date, price, bz, asp_user1, asp_time1, asp_cancel)"
                    + " SELECT wzdm, N'PC0000', ckdm, 10.0, 0, 0, GETDATE(), 0, 0, N'ui-test-20261128', GETDATE(), N'N'"
                    + " FROM dbo.kucun WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no)='XH-20260904'")) {
              sb.append("insert PC0000 -> ").append(ins.executeUpdate()).append(" 行\n");
            }
          }
        }
      } else {
        try (PreparedStatement ps = c.prepareStatement(
            "UPDATE dbo.kucun SET yl = 0 WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no) IN ('XH-20260904','XH-20260914','XH-20261014','PC0000')")) {
          sb.append("clean -> ").append(ps.executeUpdate()).append(" 行归零\n");
        }
      }
      c.commit();
      try (Statement st = c.createStatement();
           ResultSet rs = st.executeQuery("SELECT RTRIM(lot_no) AS lot, yl FROM dbo.kucun WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND ISNULL(yl,0) > 0 ORDER BY lot")) {
        sb.append("现在 v_stock_pick 行:\n");
        while (rs.next()) sb.append("  ").append(rs.getString(1)).append(" = ").append(rs.getBigDecimal(2)).append("\n");
      }
    } catch (SQLException e) {
      sb.append("ERR ").append(e.getMessage());
    }
    Files.writeString(Path.of("D:/YINJIA-main/_scratch/q6.out.txt"), sb.toString(), StandardCharsets.UTF_8);
  }
}
