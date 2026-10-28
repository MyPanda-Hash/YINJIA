import java.sql.*;

/** 只读:摸清 RD_APPROVAL / RD_PLAN 的物理表、单据状态取值、以及两张单的关联键。 */
public class _Q4 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "RD 物理表", "SELECT name FROM sys.tables WHERE name LIKE N'rd[_]%' ORDER BY name");
            q(c, "yj_doc_status 行数/状态值", "SELECT panel_code + ' | ' + state + ' x' + CAST(COUNT(*) AS varchar) FROM yj_doc_status WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') GROUP BY panel_code, state ORDER BY 1");
            q(c, "yj_doc_status 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.yj_doc_status') ORDER BY column_id");
            q(c, "RD_APPROVAL 单据状态取值", "SELECT ISNULL(单据状态,N'(null)') + ' x' + CAST(COUNT(*) AS varchar) FROM rd_approval_head GROUP BY 单据状态 ORDER BY 1");
            q(c, "RD_APPROVAL 头列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_approval_head') ORDER BY column_id");
            q(c, "RD_PLAN 头列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_plan_head') ORDER BY column_id");
            q(c, "RD_PLAN 文档编号取值(前20)", "SELECT TOP 20 ISNULL(文档编号,'(null)') + ' | 状态=' + ISNULL(单据状态,'-') + ' | 负责人=' + ISNULL(负责人,'-') FROM rd_plan_head ORDER BY id DESC");
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
