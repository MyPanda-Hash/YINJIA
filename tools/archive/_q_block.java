import java.sql.*;

/** 只读:看当前 SQL Server 上有没有被阻塞/长时间运行的请求(排查接口卡住)。 */
public class _q_block {
    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true",
                "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("-- 活动请求(>2s 或阻塞)");
            ResultSet rs = st.executeQuery(
                "SELECT r.session_id, r.status, r.command, r.wait_type, r.wait_time, r.blocking_session_id,"
              + " r.total_elapsed_time, DB_NAME(r.database_id) AS db, SUBSTRING(t.text,1,120) AS sql"
              + " FROM sys.dm_exec_requests r OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t"
              + " WHERE r.session_id <> @@SPID AND (r.total_elapsed_time > 2000 OR r.blocking_session_id <> 0)"
              + " ORDER BY r.total_elapsed_time DESC");
            int n = 0;
            while (rs.next()) {
                n++;
                System.out.println("   sid=" + rs.getInt(1) + " " + rs.getString(2) + " " + rs.getString(3)
                        + " wait=" + rs.getString(4) + "/" + rs.getLong(5) + "ms blockedBy=" + rs.getInt(6)
                        + " elapsed=" + rs.getLong(7) + "ms db=" + rs.getString(8));
                System.out.println("      sql: " + rs.getString(9));
            }
            if (n == 0) System.out.println("   (无)");
            System.out.println("-- 打开的事务");
            rs = st.executeQuery("SELECT session_id, open_transaction_count, login_name, status FROM sys.dm_exec_sessions"
                    + " WHERE open_transaction_count > 0 AND session_id <> @@SPID");
            n = 0;
            while (rs.next()) {
                n++;
                System.out.println("   sid=" + rs.getInt(1) + " tx=" + rs.getInt(2) + " " + rs.getString(3) + " " + rs.getString(4));
            }
            if (n == 0) System.out.println("   (无)");
        }
    }
}
