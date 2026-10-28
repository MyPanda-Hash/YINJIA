import java.sql.*;

/** 只读:rd_approval / rd_plan / rd_progress 结构 + 真实单据状态样例。 */
public class _Q5 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "rd_approval 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_approval') ORDER BY column_id");
            q(c, "rd_plan 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_plan') ORDER BY column_id");
            q(c, "rd_progress 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_progress') ORDER BY column_id");
            q(c, "rd_progress_detail 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_progress_detail') ORDER BY column_id");
            q(c, "行数", "SELECT 'approval=' + CAST((SELECT COUNT(*) FROM rd_approval) AS varchar) + ' plan=' + CAST((SELECT COUNT(*) FROM rd_plan) AS varchar) + ' progress=' + CAST((SELECT COUNT(*) FROM rd_progress) AS varchar) + ' progress_detail=' + CAST((SELECT COUNT(*) FROM rd_progress_detail) AS varchar)");
            q(c, "doc_status 分布(RD)", "SELECT panel_code + ' pending=' + CAST(ISNULL(pending,'-') AS varchar) + ' shr=' + ISNULL(shr,'-') + ' archived=' + CAST(ISNULL(archived,'-') AS varchar) + ' stopped=' + ISNULL(stopped,'-') + ' saved=' + CAST(ISNULL(saved,'-') AS varchar) + ' | ' + doc_no FROM yj_doc_status WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') ORDER BY panel_code, doc_no");
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= md.getColumnCount(); i++) { if (i > 1) sb.append(" | "); sb.append(rs.getString(i)); }
                System.out.println("  " + label + ": " + sb);
            }
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
