import java.sql.*;
public class _q_purge_zc {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      // 只清本探针建的两张单(0016 已作废保留痕迹;0017/0018 是纯测试产物,连明细一起物理删)
      int d = st.executeUpdate("DELETE FROM qc_proc_insp_detail WHERE [单据编号] IN (N'ZC-2026-10-0017',N'ZC-2026-10-0018')");
      int h = st.executeUpdate("DELETE FROM qc_proc_insp_head WHERE [单据编号] IN (N'ZC-2026-10-0017',N'ZC-2026-10-0018')");
      System.out.println("删除 head=" + h + " detail=" + d);
      ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'");
      rs.next(); System.out.println("存活明细行 = " + rs.getInt(1));
      ResultSet r2 = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'");
      r2.next(); System.out.println("存活单头 = " + r2.getInt(1));
      ResultSet r3 = st.executeQuery("SELECT [单据编号],COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [单据编号]");
      while (r3.next()) System.out.println("  " + r3.getString(1) + " -> " + r3.getInt(2));
    }
  }
}
