import java.sql.*;

/**
 * 数采平台(bs_dc_*)取证探针(只读)。
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib/mssql-jdbc.jar archive/_dc-platform/_DcProbe.java
 *   环境变量 YINJIA_SQL_DB 切库(默认 HSDZ_MES),YINJIA_SQL_PASS 传口令。
 * 判定:表 7/7、设备台账有行、缺中文注明列 = 0 => [PASS],退出码 0;否则 [FAIL] 退出码 1。
 */
public class _DcProbe {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        int fail = 0;
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass); Statement st = c.createStatement()) {
            System.out.println("== " + db + " ==");
            String[] tabs = {"bs_dc_gateway","bs_dc_device","bs_dc_point","bs_dc_rule","bs_dc_sample","bs_dc_alarm","bs_dc_status_log"};
            int exist = 0;
            for (String t : tabs) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo." + t)) {
                    rs.next();
                    exist++;
                    System.out.printf("  %-20s rows=%d%n", t, rs.getInt(1));
                } catch (SQLException e) {
                    System.out.println("  " + t + "  [MISSING] " + e.getMessage());
                    fail++;
                }
            }
            System.out.println("  建表 " + exist + "/7");

            System.out.println("-- 设备台账 --");
            try (ResultSet rs = st.executeQuery(
                    "SELECT code,name,device_type,status,heartbeat_seconds,ISNULL(CONVERT(varchar(19),last_seen_at,120),'-') ,"
                  + " CASE WHEN gateway_id IS NULL THEN '未绑定' ELSE CONVERT(varchar(10),gateway_id) END, "
                  + " ISNULL(project_code,'未配置'), scada_drawn, ISNULL(CONVERT(varchar(19),last_debug_at,120),'未调试') "
                  + "FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY code")) {
                while (rs.next()) {
                    System.out.printf("  %-8s %-8s %-6s %-8s hb=%ds last=%s gw=%s proj=%s scada=%s debug=%s%n",
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5),
                        rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9), rs.getString(10));
                }
            }

            int noDesc = 0;
            try (ResultSet rs = st.executeQuery(
                    "SELECT o.name, cl.name FROM sys.columns cl JOIN sys.objects o ON o.object_id=cl.object_id "
                  + "WHERE o.type='U' AND o.name LIKE 'bs[_]dc[_]%' AND cl.name NOT LIKE 'asp[_]%' AND cl.name<>'id' "
                  + "AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=cl.object_id "
                  + "AND ep.minor_id=cl.column_id AND ep.name='MS_Description')")) {
                while (rs.next()) { System.out.println("  缺注明: " + rs.getString(1) + "." + rs.getString(2)); noDesc++; }
            }
            System.out.println("  缺中文注明列 = " + noDesc);
            int devRows = 0;
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y'")) { rs.next(); devRows = rs.getInt(1); }
            if (noDesc > 0) fail++;
            if (devRows == 0) { System.out.println("  [FAIL] 设备台账为空"); fail++; }
        }
        System.out.println(fail == 0 ? "RESULT: PASS" : "RESULT: FAIL-" + fail);
        if (fail != 0) System.exit(1);
    }
}
