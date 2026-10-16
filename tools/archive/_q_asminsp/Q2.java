import java.sql.*;

/** 一次性探针:qc_proc_insp_detail 物理列 + yj_translation 现状 + 三张单明细列。 */
public class Q2 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "qc_proc_insp_detail cols",
                "SELECT name, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id "
                    + "WHERE c.object_id=OBJECT_ID('dbo.qc_proc_insp_detail') ORDER BY c.column_id");
            q(c, "qc_mold_insp_detail / qc_cut_insp_detail cols",
                "SELECT OBJECT_NAME(object_id) AS tbl, name FROM sys.columns WHERE object_id IN (OBJECT_ID('dbo.qc_mold_insp_detail'),OBJECT_ID('dbo.qc_cut_insp_detail')) ORDER BY object_id, column_id");
            q(c, "comments on qc_proc_insp_detail 检查频率/检验仪器",
                "SELECT c.name, ep.value FROM sys.columns c LEFT JOIN sys.extended_properties ep "
                    + " ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                    + "WHERE c.object_id IN (OBJECT_ID('dbo.qc_proc_insp_detail')) AND c.name IN (N'检查频率', N'检验仪器', N'不合格应对措施', N'检验要求', N'检验方法')");
            q(c, "translations for labels of interest",
                "SELECT scope, ref_key, locale, text, source FROM yj_translation WHERE ref_key IN (N'检验要求', N'标准要求', N'检查频率', N'检验仪器', N'不合格应对措施', N'检验方法', N'检测频率', N'控制方法') ORDER BY ref_key, locale");
            q(c, "yj_field data_type for 标准要求/检验要求",
                "SELECT panel_code, col_name, label, data_type, place, seq, width FROM yj_field WHERE col_name IN (N'标准要求', N'检验要求') ORDER BY panel_code");
            q(c, "detail rows sample of qc_asm_insp_detail",
                "SELECT TOP 8 单据编号, 表区, 行号, 检验项目, 标准要求, 实测数值, 检验方法, 判定, 数量, 处理方式, 不合格数量 FROM qc_asm_insp_detail ORDER BY id");
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
