import java.sql.*;

/** 一次性探针:测试账套 结果判断 取值分布(改名后守恒核对)。 */
public class QG {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT COUNT(*) AS 总行数,"
               + " SUM(CASE WHEN 结果判断 IS NOT NULL THEN 1 ELSE 0 END) AS 结果判断有值,"
               + " SUM(CASE WHEN 结果判断 = N'合格' THEN 1 ELSE 0 END) AS 合格,"
               + " SUM(CASE WHEN 结果判断 = N'不合格' THEN 1 ELSE 0 END) AS 不合格,"
               + " SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废行"
               + " FROM dbo.qc_asm_insp_detail")) {
            ResultSetMetaData m = rs.getMetaData();
            for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            while (rs.next()) {
                for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
        }
    }
}
