import java.sql.*;

/**
 * 只读核对:测试账套数采设备 132 台里,哪些不属于联网导入的 LW-001..LW-129。
 *
 * <pre>
 *   cd tools
 *   YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_dc-device-import-20261019\_Q2.java
 * </pre>
 */
public class _Q2 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES_TEST");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "设备总数(全部)", "SELECT COUNT(*) FROM bs_dc_device");
            q(c, "未作废", "SELECT COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            q(c, "LW-* 数量", "SELECT COUNT(*) FROM bs_dc_device WHERE code LIKE N'LW-[0-9][0-9][0-9]'");
            q(c, "bs_dc_device 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_dc_device') ORDER BY column_id");
            q(c, "非 LW-001..129 的行(明细)",
                    "SELECT code + ' | ' + name + ' | ' + ISNULL(device_type,'-')"
                            + " + ' | 作废=' + ISNULL(asp_cancel,'N') + ' | 建档=' + ISNULL(CONVERT(varchar,asp_time1,120),'-')"
                            + " FROM bs_dc_device WHERE code NOT LIKE N'LW-[0-9][0-9][0-9]' ORDER BY code");
            q(c, "重复 code", "SELECT code + ' x' + CAST(COUNT(*) AS varchar) FROM bs_dc_device GROUP BY code HAVING COUNT(*) > 1");
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
                    if (i > 1) sb.append(" | ");
                    sb.append(rs.getString(i));
                }
                System.out.println("  " + label + ": " + sb);
                n++;
            }
            if (n == 0) System.out.println("  " + label + ": (空)");
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
