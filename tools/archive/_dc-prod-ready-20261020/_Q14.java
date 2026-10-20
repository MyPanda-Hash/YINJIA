import java.sql.*;

/** 只读:正式账套每台设备缺哪几项(五连逐项)。 */
public class _Q14 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " 设备缺项 ==");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT d.code, ISNULL(d.device_type,''), "
                                 + " CASE WHEN d.gateway_id IS NULL THEN 'X' ELSE 'v' END, "
                                 + " CASE WHEN ISNULL(d.project_code,'') = '' THEN 'X' ELSE 'v' END, "
                                 + " CASE WHEN ISNULL(d.scada_drawn,'N') = 'Y' THEN 'v' ELSE 'X' END, "
                                 + " CASE WHEN EXISTS (SELECT 1 FROM bs_dc_rule r WHERE r.device_id=d.id AND ISNULL(r.asp_cancel,'N')<>'Y' AND r.enabled='Y') THEN 'v' ELSE 'X' END, "
                                 + " CASE WHEN d.last_debug_at IS NULL THEN 'X' ELSE 'v' END, "
                                 + " (SELECT COUNT(*) FROM bs_dc_point p WHERE p.device_id=d.id AND ISNULL(p.asp_cancel,'N')<>'Y'), "
                                 + " (SELECT COUNT(*) FROM bs_dc_rule r WHERE r.device_id=d.id AND ISNULL(r.asp_cancel,'N')<>'Y' AND r.enabled='Y') "
                                 + " FROM bs_dc_device d WHERE ISNULL(d.asp_cancel,'N') <> 'Y' ORDER BY d.code")) {
                while (rs.next()) {
                    System.out.println(rs.getString(1) + " (" + rs.getString(2) + ") 网关" + rs.getString(3)
                            + " 工程" + rs.getString(4) + " 组态" + rs.getString(5) + " 规则" + rs.getString(6)
                            + " 调试" + rs.getString(7) + " | 采集点=" + rs.getInt(8) + " 启用规则=" + rs.getInt(9));
                }
            }
        }
    }
}
