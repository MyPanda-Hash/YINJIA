import java.sql.*;

/** 只读:两个账套 LW-001..129 的写入时间分布 + 那 4 台原有设备的启停/心跳。 */
public class _Q3 {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
                System.out.println("== " + db + " ==");
                q(c, "LW-* 建档时间分布", "SELECT CONVERT(varchar(19), asp_time1, 120) + N' x' + CAST(COUNT(*) AS varchar) FROM bs_dc_device WHERE code LIKE N'LW-[0-9][0-9][0-9]' GROUP BY CONVERT(varchar(19), asp_time1, 120) ORDER BY 1");
                q(c, "原有设备明细", "SELECT code + ' | 启停=' + ISNULL(enabled,'-') + ' | 状态=' + ISNULL(status,'-') + ' | 网关=' + ISNULL(CAST(gateway_id AS varchar),'NULL') + ' | 最后心跳=' + ISNULL(CONVERT(varchar(19), last_seen_at, 120),'NULL') + ' | 建档=' + ISNULL(CONVERT(varchar(19), asp_time1, 120),'-') FROM bs_dc_device WHERE code NOT LIKE N'LW-[0-9][0-9][0-9]' ORDER BY code");
                q(c, "迁移登记", "SELECT script_name + ' @' + CONVERT(varchar(19), applied_at, 120) FROM yj_schema_log WHERE script_name LIKE N'%dc-device-import%'");
            }
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next()) System.out.println("  " + label + ": " + rs.getString(1) + (rs.getMetaData().getColumnCount() > 1 ? " | " + rs.getString(2) : "")) ;
            if (n == 0 && false) System.out.println("");
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
