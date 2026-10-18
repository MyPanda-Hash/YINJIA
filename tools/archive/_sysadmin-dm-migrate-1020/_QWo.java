import java.sql.*;

/** _QWo.java — 两条 wo-completion 迁移的登记时间 + 是否与文件哈希一致(判断"登记了但没生效") */
public class _QWo {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true");
             PreparedStatement ps = c.prepareStatement(
                     "SELECT script_name, content_hash, applied_at FROM yj_schema_log WHERE script_name LIKE N'%wo-completion%' ORDER BY applied_at")) {
            System.out.println("===== " + db + " =====");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String h = rs.getString(2);
                    System.out.println("  " + rs.getString(1) + "\n    applied_at=" + rs.getString(3) + "  hash=" + (h == null ? "null" : h.substring(0, Math.min(16, h.length())) + "…"));
                }
            }
        }
    }
}
