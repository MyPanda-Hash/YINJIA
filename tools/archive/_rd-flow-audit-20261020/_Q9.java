import java.sql.*;

/** 只读核对:PROJECT_FLOW 授权行 + 面板译名(两账套)。 */
public class _Q9 {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
                System.out.println("== " + db + " ==");
                q(c, "角色数", "SELECT CAST(COUNT(*) AS varchar) FROM yj_role");
                q(c, "PROJECT_FLOW 授权", "SELECT CAST(COUNT(*) AS varchar) + ' 行 / perms=' + ISNULL(MIN(perms),'-') FROM yj_role_panel WHERE panel_code = N'PROJECT_FLOW'");
                q(c, "缺授权的角色", "SELECT r.name FROM yj_role r WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id=r.id AND x.panel_code=N'PROJECT_FLOW')");
                q(c, "面板译名", "SELECT locale + '=' + text FROM yj_translation WHERE scope='panel' AND ref_key=N'项目流程管控'");
            }
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            boolean any = false;
            while (rs.next()) { any = true; System.out.println("  " + label + ": " + rs.getString(1)); }
            if (!any) System.out.println("  " + label + ": (空)");
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
