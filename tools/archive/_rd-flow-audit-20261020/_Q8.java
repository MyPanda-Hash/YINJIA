import java.sql.*;

/** 只读:RD 审批留痕全量(两账套),看每步真实动作名。 */
public class _Q8 {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
                System.out.println("== " + db + " ==");
                q(c, "留痕", "SELECT TOP 40 panel_code + ' ' + form_no + ' ' + action + '/' + result + ' by ' + ISNULL(operator,'-') + ' @' + ISNULL(CONVERT(varchar(19), create_time, 120),'-') + ' | ' + ISNULL(LEFT(opinion,30),'-') FROM yj_form_approval WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') ORDER BY id DESC");
            }
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) System.out.println("  " + label + ": " + rs.getString(1));
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
