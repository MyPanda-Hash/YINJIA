import java.sql.*;

/** 一次性探针:定位「测量值1..5」迁移自检失败项。 */
public class Q9 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("########## " + db + " ##########");
            q(c, "E1 列(三表 × 测量值1..5)",
                "SELECT t.v AS tbl, COUNT(*) AS 有列数 FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v) "
              + "JOIN sys.columns col ON col.object_id = OBJECT_ID(N'dbo.' + t.v) AND col.name LIKE N'测量值%' GROUP BY t.v");
            q(c, "E2 yj_field(place/detail/小数/visible)",
                "SELECT panel_code, col_name, data_type, place, seq, width, visible, hidden FROM yj_field "
              + "WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') AND col_name LIKE N'测量值%' ORDER BY panel_code, seq");
            q(c, "E2 计数(期望 15)",
                "SELECT COUNT(*) AS n FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') "
              + "AND col_name LIKE N'测量值%' AND place = N'detail' AND data_type = N'小数' AND visible = 1");
            q(c, "E3 列注明计数(期望 15)",
                "SELECT COUNT(*) AS n FROM sys.extended_properties ep WHERE ep.name = N'MS_Description' AND ep.class = 1 AND ep.minor_id > 0 "
              + "AND OBJECT_NAME(ep.major_id) IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail') AND COL_NAME(ep.major_id, ep.minor_id) LIKE N'测量值%'");
            q(c, "E4 次序:实测数值 / 测量值1 / 测量值5 / 检验方法 / 检查频率",
                "SELECT panel_code, col_name, seq FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') "
              + "AND col_name IN (N'实测数值', N'测量值1', N'测量值5', N'检验方法', N'检查频率', N'判定') ORDER BY panel_code, seq");
            q(c, "E5 译名计数(期望 5)",
                "SELECT COUNT(*) AS n FROM yj_translation WHERE scope = N'field' AND locale = N'en' "
              + "AND ref_key IN (N'测量值1', N'测量值2', N'测量值3', N'测量值4', N'测量值5')");
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
