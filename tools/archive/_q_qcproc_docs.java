import java.sql.*;
public class _q_qcproc_docs {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             Statement st = c.createStatement()) {
            ResultSet rs = st.executeQuery("SELECT h.单据编号, h.单据状态, h.产品编码, (SELECT COUNT(*) FROM qc_proc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行 FROM qc_proc_insp_head h ORDER BY h.单据编号 DESC");
            while (rs.next()) System.out.println(rs.getString(1)+" | "+rs.getString(2)+" | "+rs.getString(3)+" | rows="+rs.getInt(4));
        }
    }
}
