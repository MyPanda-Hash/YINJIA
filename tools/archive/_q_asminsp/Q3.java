import java.sql.*;

/** 一次性探针:视图/报表绑定/迁移链相关现状。 */
public class Q3 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "views referencing insp detail tables",
                "SELECT o.name AS view_name, m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id "
                    + "WHERE m.definition LIKE N'%qc_asm_insp_detail%' OR m.definition LIKE N'%qc_mold_insp_detail%' OR m.definition LIKE N'%qc_cut_insp_detail%'");
            q(c, "views referencing 标准要求",
                "SELECT o.name AS view_name FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE m.definition LIKE N'%标准要求%'");
            q(c, "all views (names)",
                "SELECT name FROM sys.views WHERE type='V' ORDER BY name");
            q(c, "comments on qc_asm_insp_detail cols",
                "SELECT c.name, ep.value FROM sys.columns c LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
                    + "WHERE c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') ORDER BY c.column_id");
            q(c, "remarks: yj_field alias for 标准要求",
                "SELECT panel_code, col_name, label, alias, label_en, col_group, tab_key FROM yj_field WHERE panel_code IN ('QC_ASM_INSP','QC_MOLD_INSP','QC_CUT_INSP') AND col_name IN (N'标准要求', N'检验方法', N'表区')");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            int rows = 0;
            while (rs.next()) {
                rows++;
                for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
            System.out.println("(" + rows + " rows)");
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
