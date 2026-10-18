import java.sql.*;

/** _QDc.java — 数采平台实际建出来的 bs_dc_* 表清单(与脚本声明对照) */
public class _QDc {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT o.name, o.type_desc, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=o.object_id) AS cols "
                             + "FROM sys.objects o WHERE o.name LIKE 'bs_dc[_]%' OR o.name LIKE 'v_dc[_]%' ORDER BY o.name")) {
            System.out.println("===== " + db + " 数采平台对象 =====");
            int n = 0;
            while (rs.next()) { n++; System.out.println(String.format("  %-24s %-12s 列=%d", rs.getString(1), rs.getString(2), rs.getInt(3))); }
            if (n == 0) System.out.println("  (无)");
        }
    }
}
