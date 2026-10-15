import java.sql.*;
public class _q_cells2 {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB","HSDZ_MES");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("DB="+db);
            ResultSet rs = st.executeQuery("SELECT 单据编号, 表区, COUNT(*) AS n, SUM(CASE WHEN 格数 IS NULL THEN 1 ELSE 0 END) AS nullcnt, MIN(格数) AS mn, MAX(格数) AS mx FROM qc_proc_insp_detail GROUP BY 单据编号, 表区 ORDER BY 单据编号 DESC, 表区");
            while (rs.next()) System.out.println(rs.getString(1)+" | "+rs.getString(2)+" | n="+rs.getInt(3)+" null="+rs.getInt(4)+" min="+rs.getObject(5)+" max="+rs.getObject(6));
        }
    }
}
