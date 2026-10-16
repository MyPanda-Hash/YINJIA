import java.sql.*;
public class _q_seqs {
  public static void main(String[] a) throws Exception {
    Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
         Statement st = c.createStatement()) {
      ResultSet rs = st.executeQuery("SELECT seq, col_name, data_type, visible, hidden FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND seq>=70 ORDER BY seq, id");
      while (rs.next()) System.out.println("seq="+rs.getInt(1)+"  "+rs.getString(2)+"  "+rs.getString(3)+"  v="+rs.getInt(4)+" h="+rs.getInt(5));
    }
  }
}
