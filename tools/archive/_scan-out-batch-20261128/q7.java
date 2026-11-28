import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 清掉验证用的测试库存:三行归零 + 删掉本任务插入的 PC0000 行(按 asp_user1 标记)。 */
public class q7 {
  public static void main(String[] a) throws Exception {
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=8";
    StringBuilder sb = new StringBuilder();
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
      c.setAutoCommit(false);
      try (PreparedStatement ps = c.prepareStatement(
          "UPDATE dbo.kucun SET yl = 0 WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no) IN ('XH-20260904','XH-20260914','XH-20261014')")) {
        sb.append("归零 3 个批号 -> ").append(ps.executeUpdate()).append(" 行\n");
      }
      try (PreparedStatement ps = c.prepareStatement(
          "DELETE FROM dbo.kucun WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND RTRIM(lot_no)='PC0000' AND asp_user1=N'ui-test-20261128'")) {
        sb.append("删除造的 PC0000 行 -> ").append(ps.executeUpdate()).append(" 行\n");
      }
      c.commit();
      try (Statement st = c.createStatement();
           ResultSet rs = st.executeQuery("SELECT RTRIM(lot_no) AS lot, yl FROM dbo.kucun WHERE wzdm='YJ-XH-001' AND ckdm='YCL-01' AND ISNULL(yl,0) > 0")) {
        sb.append("清理后仍有货的行:\n");
        while (rs.next()) sb.append("  ").append(rs.getString(1)).append(" = ").append(rs.getBigDecimal(2)).append("\n");
      }
    } catch (SQLException e) {
      sb.append("ERR ").append(e.getMessage());
    }
    Files.writeString(Path.of("D:/YINJIA-main/_scratch/q7.out.txt"), sb.toString(), StandardCharsets.UTF_8);
  }
}
