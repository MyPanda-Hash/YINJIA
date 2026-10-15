import java.sql.*;
public class _q_write_test {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=5","yinjia","Yinjia@2026")) {
      c.setAutoCommit(true);
      try (Statement st = c.createStatement()) { st.setQueryTimeout(8);
        long t0=System.currentTimeMillis();
        st.executeUpdate("UPDATE qc_proc_insp_head SET 备注=N'lockprobe' WHERE id=(SELECT MAX(id) FROM qc_proc_insp_head)");
        System.out.println("UPDATE head 用时 " + (System.currentTimeMillis()-t0) + "ms");
        t0=System.currentTimeMillis();
        st.executeUpdate("UPDATE qc_proc_insp_detail SET 备注2=N'lockprobe' WHERE id=(SELECT MAX(id) FROM qc_proc_insp_detail)");
        System.out.println("UPDATE detail 用时 " + (System.currentTimeMillis()-t0) + "ms");
      }
    }
  }
}
