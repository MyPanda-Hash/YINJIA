import java.sql.*;

/**
 * 只读核对:数采设备台账/备份参数/备份留痕的当前状态(两个账套各跑一次)。
 *
 * <pre>
 *   cd tools
 *   java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_dc-device-import-20261019\_Q.java
 *   YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_dc-device-import-20261019\_Q.java
 * </pre>
 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "设备总数(未作废)", "SELECT COUNT(*) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            q(c, "其中 LW-*(联网导入)", "SELECT COUNT(*) FROM bs_dc_device WHERE code LIKE N'LW-%' AND ISNULL(asp_cancel,'N') <> 'Y'");
            q(c, "按类型", "SELECT device_type + '=' + CAST(COUNT(*) AS varchar) FROM bs_dc_device WHERE code LIKE N'LW-%' GROUP BY device_type ORDER BY device_type");
            q(c, "采集点数", "SELECT COUNT(*) FROM bs_dc_point WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            q(c, "采样流水", "SELECT COUNT(*) FROM bs_dc_sample");
            q(c, "备份表/参数", "SELECT 'yj_backup_log=' + CAST((SELECT COUNT(*) FROM sys.tables WHERE name=N'yj_backup_log') AS varchar) + N' 参数=' + CAST((SELECT COUNT(*) FROM yj_app_setting WHERE setting_key LIKE N'db_backup.%') AS varchar)");
            q(c, "备份参数值", "SELECT setting_key + '=' + ISNULL(setting_value,'') FROM yj_app_setting WHERE setting_key LIKE N'db_backup.%' ORDER BY setting_key");
            q(c, "备份记录", "SELECT TOP 5 run_type + '/' + status + ' ' + ISNULL(file_path,'-') + ' ' + CAST(ISNULL(file_size_kb,0) AS varchar) + 'KB' FROM yj_backup_log ORDER BY id DESC");
            q(c, "yj_backup_log 列/缺注", "SELECT CAST(COUNT(*) AS varchar) + N'列/缺注' + CAST((SELECT COUNT(*) FROM sys.columns cl WHERE cl.object_id=OBJECT_ID('dbo.yj_backup_log') AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=cl.object_id AND ep.minor_id=cl.column_id AND ep.name=N'MS_Description')) AS varchar) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.yj_backup_log')");
        }
    }

    static void q(Connection c, String label, String sql) throws SQLException {
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
        }
    }
}
