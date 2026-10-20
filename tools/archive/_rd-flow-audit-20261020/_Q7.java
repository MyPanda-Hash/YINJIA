import java.sql.*;

/** 只读:yj_form_approval 结构 + RD 留痕样例 + yj_doc_status 时间列样例。 */
public class _Q7 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "yj_form_approval 列", "SELECT name + ':' + TYPE_NAME(user_type_id) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.yj_form_approval') ORDER BY column_id");
            q(c, "RD 留痕样例", "SELECT TOP 25 panel_code + ' ' + form_no + ' ' + action + '/' + result + ' by ' + ISNULL(operator,'-') + ' @' + ISNULL(CONVERT(varchar(19), asp_time1, 120),'-') + ' | ' + ISNULL(LEFT(opinion,40),'-') FROM yj_form_approval WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') ORDER BY id DESC");
            q(c, "doc_status(RD) 时间列", "SELECT panel_code + ' ' + doc_no + ' pending=' + ISNULL(pending,'-') + '/' + ISNULL(pending_by,'-') + '@' + ISNULL(CONVERT(varchar(19),pending_at,120),'-') + ' shr=' + ISNULL(shr,'-') + '@' + ISNULL(CONVERT(varchar(19),shsj,120),'-') + ' archived=' + ISNULL(archived,'-') + '@' + ISNULL(CONVERT(varchar(19),archived_at,120),'-') FROM yj_doc_status WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') ORDER BY doc_no");
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
