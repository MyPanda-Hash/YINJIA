import java.sql.*;

/** 只读:bs_dc_gateway / bs_dc_point / bs_dc_rule 的列(为"把测试账套设备置为可用"准备). */
public class _Q12 {
    public static void main(String[] a) throws Exception {
        String db = "HSDZ_MES_TEST";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            for (String t : new String[]{"bs_dc_gateway", "bs_dc_point", "bs_dc_rule", "bs_dc_device"}) {
                q(c, t + " 列", "SELECT name + ' ' + TYPE_NAME(user_type_id) + ISNULL('(' + CAST(max_length AS varchar) + ')','') FROM sys.columns WHERE object_id=OBJECT_ID('dbo." + t + "') ORDER BY column_id");
                q(c, t + " 行数", "SELECT CAST(COUNT(*) AS varchar) FROM " + t);
            }
            q(c, "枚举:网关协议/状态样例", "SELECT TOP 5 code + '|' + ISNULL(protocol,'-') + '|' + ISNULL(host,'-') + '|' + ISNULL(CAST(port AS varchar),'-') + '|' + ISNULL(status,'-') + '|' + ISNULL(enabled,'-') FROM bs_dc_gateway");
            q(c, "枚举:规则样例", "SELECT TOP 5 code + '|' + name + '|' + ISNULL(rule_type,'-') + '|' + ISNULL(expression,'-') + '|' + ISNULL(level,'-') + '|' + ISNULL(enabled,'-') FROM bs_dc_rule");
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
