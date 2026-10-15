import java.sql.*;
public class _q_cells3 {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             Statement st = c.createStatement()) {
            ResultSet rs = st.executeQuery("SELECT id, [表区], [检验项目], [格数], ISNULL(asp_cancel,'N') AS cancel FROM qc_proc_insp_detail WHERE 单据编号=N'ZC-2026-10-0002' ORDER BY id");
            while (rs.next()) System.out.println(rs.getLong(1)+" | "+rs.getString(2)+" | "+rs.getString(3)+" | cells="+rs.getObject(4)+" | cancel="+rs.getString(5));
        }
    }
}
