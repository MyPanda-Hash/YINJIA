import java.sql.*;

/** 一次性探针:核对 客户名称 / 产线常规功能性结果 / 结果判断 的既有口径(制程检验单先例 + 译名 + 注释)。 */
public class QB {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "制程检验单上的同名字段(yj_field)",
                "SELECT panel_code, col_name, label, data_type, ISNULL(dict_sql,N'') AS dict_sql, place, seq, width, editable, required, visible, hidden "
              + "FROM yj_field WHERE col_name IN (N'客户名称', N'结果判断', N'产线常规功能性结果') ORDER BY panel_code, seq");
            q(c, "字段译名(全语言计数 + en)",
                "SELECT ref_key, COUNT(*) AS 语言数, MAX(CASE WHEN locale='en' THEN text END) AS en FROM yj_translation "
              + "WHERE scope=N'field' AND ref_key IN (N'客户名称', N'结果判断', N'产线常规功能性结果') GROUP BY ref_key");
            q(c, "制程检验单明细 结果判断 的物理列与注释",
                "SELECT c.name, t.name AS typ, c.max_length, ep.value AS 注释 FROM sys.columns c "
              + "JOIN sys.types t ON t.user_type_id=c.user_type_id "
              + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
              + "WHERE c.object_id=OBJECT_ID('dbo.qc_proc_insp_detail') AND c.name IN (N'客户名称', N'结果判断')");
            q(c, "制程检验单头/明细里 客户名称 的实际取值(前 5 张单)",
                "SELECT TOP 5 单据编号, 客户名称, 产品编码 FROM qc_proc_insp_head ORDER BY id DESC");
            q(c, "结果判断 在制程检验单明细里的实际取值",
                "SELECT ISNULL(结果判断,N'(null)') AS 结果判断, COUNT(*) AS 行数 FROM qc_proc_insp_detail GROUP BY 结果判断");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            while (rs.next()) {
                for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
