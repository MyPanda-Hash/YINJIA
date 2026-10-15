import java.sql.*;

/** 数据库时钟 vs 本机时钟 —— 判定 GETDATE() 是否比本地时间少 8 小时(UTC)。 */
public class _ProbeClock {
    public static void main(String[] a) throws Exception {
        Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
        Statement s = c.createStatement();
        ResultSet r = s.executeQuery("SELECT CONVERT(varchar(30), GETDATE(), 121) AS getdate_,"
                + " CONVERT(varchar(40), SYSDATETIMEOFFSET(), 121) AS sw_offset,"
                + " CONVERT(varchar(30), GETUTCDATE(), 121) AS utc,"
                + " CONVERT(varchar(10), SERVERPROPERTY('ComputerNamePhysicalNetBIOS')) AS host");
        r.next();
        System.out.println("SQL GETDATE()      = " + r.getString("getdate_"));
        System.out.println("SQL SYSDATETIMEOFFSET = " + r.getString("sw_offset"));
        System.out.println("SQL GETUTCDATE()   = " + r.getString("utc"));
        System.out.println("SQL host           = " + r.getString("host"));
        System.out.println("JVM now            = " + java.time.LocalDateTime.now());
        System.out.println("JVM offset         = " + java.time.ZonedDateTime.now().getOffset());
        System.out.println("OS  now            = " + new java.util.Date());
        c.close();
    }
}
