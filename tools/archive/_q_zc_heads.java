import java.sql.*;
public class _q_zc_heads {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      ResultSet rs = st.executeQuery("SELECT TOP 15 [单据编号],[单据状态],[工单号],[工单行号],ISNULL(asp_cancel,'N') AS cancel, id FROM qc_proc_insp_head ORDER BY id DESC");
      while (rs.next()) System.out.println(rs.getString(1)+" | 状态="+rs.getString(2)+" | 工单="+rs.getString(3)+"#"+rs.getObject(4)+" | cancel="+rs.getString(5)+" | id="+rs.getLong(6));
      ResultSet r2 = st.executeQuery("SELECT COUNT(*) FROM qc_proc_insp_detail WHERE [单据编号]=N'ZC-2026-10-0016'");
      r2.next(); System.out.println("ZC-2026-10-0016 明细行="+r2.getInt(1));
      ResultSet r3 = st.executeQuery("SELECT [单据编号],COUNT(*) FROM qc_proc_insp_detail GROUP BY [单据编号]");
      while (r3.next()) System.out.println("  明细分布 "+r3.getString(1)+" -> "+r3.getInt(2));
    }
  }
}
