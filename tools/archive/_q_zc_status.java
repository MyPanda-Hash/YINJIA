import java.sql.*;
public class _q_zc_status {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_proc_insp_head' AND (COLUMN_NAME LIKE N'%状态%' OR COLUMN_NAME LIKE N'%审批%' OR COLUMN_NAME LIKE N'%审核%') ORDER BY COLUMN_NAME");
      StringBuilder cols = new StringBuilder();
      while (rs.next()) cols.append(rs.getString(1)).append(" , ");
      System.out.println("状态类列: " + cols);
      ResultSet r2 = st.executeQuery("SELECT [单据编号], [单据状态], 状态, 审核人, 单据日期 FROM qc_proc_insp_head WHERE [单据编号] IN (N'ZC-2026-10-0002', N'ZC-2026-10-0016')");
      while (r2.next()) System.out.println(r2.getString(1)+" | 单据状态="+r2.getString(2)+" | 状态="+r2.getString(3)+" | 审核人="+r2.getString(4)+" | 日期="+r2.getString(5));
    }
  }
}
