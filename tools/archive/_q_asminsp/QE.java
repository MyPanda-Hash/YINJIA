import java.sql.*;

/** 一次性探针:改名前的数据盘点(判定 有值行数 / 我上一批加的 结果判断 是否为空)。 */
public class QE {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                System.out.println("########## " + db + " ##########");
                q(c, "qc_asm_insp_detail:总行数 / 判定有值 / 结果判断有值 / 产线常规功能性结果有值",
                    "SELECT COUNT(*) AS 总行数, SUM(CASE WHEN 判定 IS NOT NULL THEN 1 ELSE 0 END) AS 判定有值,"
                  + " SUM(CASE WHEN 结果判断 IS NOT NULL THEN 1 ELSE 0 END) AS 结果判断有值,"
                  + " SUM(CASE WHEN 产线常规功能性结果 IS NOT NULL THEN 1 ELSE 0 END) AS 功能结果有值"
                  + " FROM dbo.qc_asm_insp_detail");
                q(c, "判定 取值分布", "SELECT ISNULL(判定,N'(null)') AS 判定, COUNT(*) AS 行数 FROM dbo.qc_asm_insp_detail GROUP BY 判定");
                q(c, "结果判断 取值分布(期望全 null,证明上一批加的空列可安全删除)",
                    "SELECT ISNULL(结果判断,N'(null)') AS 结果判断, COUNT(*) AS 行数 FROM dbo.qc_asm_insp_detail GROUP BY 结果判断");
                q(c, "两列的列级注明",
                    "SELECT c.name, ep.value AS 注释 FROM sys.columns c LEFT JOIN sys.extended_properties ep "
                  + "ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
                  + "WHERE c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') AND c.name IN (N'判定', N'结果判断')");
                q(c, "判定/结果判断 的 yj_field 行",
                    "SELECT col_name, label, data_type, place, seq, width, editable, visible, hidden FROM yj_field "
                  + "WHERE panel_code=N'QC_ASM_INSP' AND col_name IN (N'判定', N'结果判断')");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            while (rs.next()) {
                for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
