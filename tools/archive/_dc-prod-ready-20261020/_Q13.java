import java.sql.*;

/**
 * 只读:正式账套数采设备的当前配置快照(改前留底,便于回退)。
 * 输出可直接粘回 SQL 的 UPDATE 语句(仅还原本次会动的 4 个字段:gateway_id/project_code/scada_drawn/last_debug_at)。
 */
public class _Q13 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " 设备快照 ==");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT id, code, name, device_type, ISNULL(CAST(gateway_id AS varchar),'NULL'), "
                                 + "ISNULL(project_code,''), ISNULL(scada_drawn,''), "
                                 + "ISNULL(CONVERT(varchar(19), last_debug_at, 120),''), ISNULL(enabled,''), "
                                 + "ISNULL(status,''), ISNULL(CONVERT(varchar(19), last_seen_at, 120),'') "
                                 + "FROM bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY code")) {
                while (rs.next()) {
                    System.out.println(rs.getInt(1) + " | " + rs.getString(2) + " | " + rs.getString(3)
                            + " | gw=" + rs.getString(5) + " | proj=" + rs.getString(6)
                            + " | scada=" + rs.getString(7) + " | debug=" + rs.getString(8)
                            + " | enabled=" + rs.getString(9) + " | status=" + rs.getString(10)
                            + " | seen=" + rs.getString(11));
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT code, name, ISNULL(protocol,''), ISNULL(host,''), ISNULL(CAST(port AS varchar),''), "
                                 + "ISNULL(status,''), ISNULL(enabled,'') FROM bs_dc_gateway "
                                 + "WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY code")) {
                System.out.println("== " + db + " 网关快照 ==");
                while (rs.next()) {
                    System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3)
                            + " | " + rs.getString(4) + ":" + rs.getString(5) + " | " + rs.getString(6)
                            + " | enabled=" + rs.getString(7));
                }
            }
        }
    }
}
