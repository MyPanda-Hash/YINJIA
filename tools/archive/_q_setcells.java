import java.sql.*;
public class _q_setcells {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        long id = Long.parseLong(a[0]);
        int n = Integer.parseInt(a[1]);
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             PreparedStatement ps = c.prepareStatement("UPDATE qc_proc_insp_detail SET [格数]=? WHERE id=?")) {
            ps.setInt(1, n); ps.setLong(2, id);
            System.out.println("updated rows = " + ps.executeUpdate() + " (id=" + id + " -> cells=" + n + ")");
        }
    }
}
