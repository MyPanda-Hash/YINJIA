import java.sql.*;
public class _q_measure_cols {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             Statement st = c.createStatement()) {
            ResultSet rs = st.executeQuery("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('qc_proc_insp_detail') AND name LIKE N'测量值%' ORDER BY column_id");
            while (rs.next()) System.out.print(rs.getString(1)+" ");
            System.out.println();
            rs = st.executeQuery("SELECT col_name FROM yj_field WHERE panel_code=N'QC_PROC_INSP' AND col_name LIKE N'测量值%' ORDER BY seq");
            while (rs.next()) System.out.print(rs.getString(1)+" ");
            System.out.println();
        }
    }
}
