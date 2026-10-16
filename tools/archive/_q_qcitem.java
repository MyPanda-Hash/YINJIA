import java.sql.*;
public class _q_qcitem {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia","Yinjia@2026");
             Statement st = c.createStatement()) {
            ResultSet rs = st.executeQuery("SELECT [检验内容], COUNT(*) AS n FROM bs_qc_item GROUP BY [检验内容] ORDER BY 1");
            while (rs.next()) System.out.println("类别["+rs.getString(1)+"] = "+rs.getInt(2));
            System.out.println("--- 明细 ---");
            rs = st.executeQuery("SELECT TOP 20 [方案编码],[序号],[项目名称],[检验内容] FROM bs_qc_item ORDER BY [方案编码],[序号]");
            while (rs.next()) System.out.println(rs.getString(1)+" | "+rs.getObject(2)+" | "+rs.getString(3)+" | "+rs.getString(4));
        }
    }
}
