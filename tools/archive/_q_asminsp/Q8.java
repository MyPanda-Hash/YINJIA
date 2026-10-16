import java.sql.*;

/** 一次性探针:四张检验单明细/头表的列数(刷新数据库表清单用)。 */
public class Q8 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT OBJECT_NAME(object_id) AS t, COUNT(*) AS n FROM sys.columns WHERE object_id IN ("
                 + "OBJECT_ID('dbo.qc_asm_insp_head'),OBJECT_ID('dbo.qc_mold_insp_head'),OBJECT_ID('dbo.qc_cut_insp_head'),"
                 + "OBJECT_ID('dbo.qc_asm_insp_detail'),OBJECT_ID('dbo.qc_mold_insp_detail'),OBJECT_ID('dbo.qc_cut_insp_detail'),"
                 + "OBJECT_ID('dbo.qc_proc_insp_detail')) GROUP BY OBJECT_NAME(object_id) ORDER BY t")) {
            while (rs.next()) System.out.println(rs.getString(1) + " = " + rs.getInt(2) + " 列");
        }
    }
}
