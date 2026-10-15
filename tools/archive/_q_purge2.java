import java.sql.*;
public class _q_purge2 {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      int d = st.executeUpdate("DELETE FROM qc_proc_insp_detail WHERE [单据编号]=N'ZC-2026-10-0019'");
      int h = st.executeUpdate("DELETE FROM qc_proc_insp_head WHERE [单据编号]=N'ZC-2026-10-0019'");
      System.out.println("清理 0019 => head=" + h + " detail=" + d);
      ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'");
      rs.next(); System.out.println("存活明细行 = " + rs.getInt(1) + "(应为 17)");
      ResultSet r2 = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'");
      r2.next(); System.out.println("存活单头 = " + r2.getInt(1) + "(应为 15)");
    }
  }
}
