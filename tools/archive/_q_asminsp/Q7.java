import java.sql.*;

/** 一次性探针:迁移后复核(列 / yj_field / 注明 / 译名 / 旧列名残留),两个账套都跑。 */
public class Q7 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("########## " + db + " ##########");
            q(c, "三张明细表:检验要求/检查频率 列在?旧列名残留?",
                "SELECT t.v AS tbl,"
                    + " CASE WHEN COL_LENGTH(N'dbo.' + t.v, N'检验要求') IS NULL THEN N'缺' ELSE N'有' END AS 检验要求,"
                    + " CASE WHEN COL_LENGTH(N'dbo.' + t.v, N'检查频率') IS NULL THEN N'缺' ELSE N'有' END AS 检查频率,"
                    + " CASE WHEN COL_LENGTH(N'dbo.' + t.v, N'标准要求') IS NULL THEN N'已清' ELSE N'仍在' END AS 标准要求旧列"
                    + " FROM (VALUES (N'qc_mold_insp_detail'), (N'qc_cut_insp_detail'), (N'qc_asm_insp_detail')) AS t(v)");
            q(c, "yj_field:三张单的 检验要求/检查频率 行",
                "SELECT panel_code, col_name, data_type, place, seq, width, editable, visible, hidden FROM yj_field "
                    + "WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_ASM_INSP') "
                    + "AND col_name IN (N'检验要求', N'检查频率', N'标准要求') ORDER BY panel_code, seq");
            q(c, "列级注明",
                "SELECT OBJECT_NAME(ep.major_id) AS tbl, COL_NAME(ep.major_id, ep.minor_id) AS col, ep.value FROM sys.extended_properties ep "
                    + "WHERE ep.name = N'MS_Description' AND ep.minor_id > 0 "
                    + "AND OBJECT_NAME(ep.major_id) IN (N'qc_mold_insp_detail', N'qc_cut_insp_detail', N'qc_asm_insp_detail') "
                    + "AND COL_NAME(ep.major_id, ep.minor_id) IN (N'检验要求', N'检查频率') ORDER BY tbl, col");
            q(c, "译名(en)与全语言计数",
                "SELECT ref_key, COUNT(*) AS 语言数, MAX(CASE WHEN locale='en' THEN text END) AS en FROM yj_translation "
                    + "WHERE scope=N'field' AND ref_key IN (N'检验要求', N'检查频率') GROUP BY ref_key");
            q(c, "明细行数(改名未丢数据)",
                "SELECT (SELECT COUNT(*) FROM qc_mold_insp_detail) AS 成型, (SELECT COUNT(*) FROM qc_cut_insp_detail) AS 切炭,"
                    + " (SELECT COUNT(*) FROM qc_asm_insp_detail) AS 组装成品,"
                    + " (SELECT COUNT(*) FROM qc_asm_insp_detail WHERE ISNULL(标准要求,N'')<>N'') AS 非法列引用应为0");
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
