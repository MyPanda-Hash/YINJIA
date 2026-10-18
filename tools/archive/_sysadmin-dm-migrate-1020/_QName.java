import java.sql.*;

/**
 * _QName.java — yj_schema_log 里跟 sysadmin / dm 相关的登记行(排查"没登记"是不是名字不同)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QName.java HSDZ_MES
 */
public class _QName {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            System.out.println("===== " + db + " =====");
            for (String like : new String[] { "%sysadmin%", "%panels-to-dm%", "%erp-integ%", "%dm-%" }) {
                System.out.println("--- LIKE " + like + " ---");
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT script_name, applied_at FROM yj_schema_log WHERE script_name LIKE ? ORDER BY applied_at")) {
                    ps.setString(1, like);
                    try (ResultSet rs = ps.executeQuery()) {
                        int n = 0;
                        while (rs.next()) { n++; System.out.println("  " + rs.getString(2) + "  " + rs.getString(1)); }
                        if (n == 0) System.out.println("  (0)");
                    }
                }
            }
            System.out.println("--- 登记名里带 tools\\ / 路径前缀的异常行 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT script_name FROM yj_schema_log WHERE script_name LIKE '%\\%' OR script_name LIKE N'%/%%'")) {
                int n = 0;
                while (rs.next()) { n++; System.out.println("  " + rs.getString(1)); }
                if (n == 0) System.out.println("  (0)");
            }
        }
    }
}
