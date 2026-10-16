import java.sql.*;
public class _q_clean_zc {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      int n = st.executeUpdate("UPDATE qc_proc_insp_head SET asp_cancel='Y' WHERE [单据编号]=N'ZC-2026-10-0016' AND ISNULL(asp_cancel,'N')<>'Y'");
      System.out.println("作废 ZC-2026-10-0016 => " + n + " 行");
      ResultSet rs = st.executeQuery("SELECT [单据编号], ISNULL(单据状态,'(null)'), ISNULL(asp_cancel,'N') FROM qc_proc_insp_head WHERE [单据编号] IN (N'ZC-2026-10-0016',N'ZC-2026-10-0017',N'ZC-2026-10-0018')");
      while (rs.next()) System.out.println("  " + rs.getString(1) + " | 状态=" + rs.getString(2) + " | cancel=" + rs.getString(3));
      ResultSet r2 = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'");
      r2.next(); System.out.println("存活明细行 = " + r2.getInt(1));
    }
  }
}
