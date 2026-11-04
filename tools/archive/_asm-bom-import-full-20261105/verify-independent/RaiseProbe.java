import java.sql.*;

/**
 * 独立复核 C 用只读探针:验证 SQL Server RAISERROR 两种 severity 在 JDBC 下的行为,
 * 即 DbSync 的「severity 16 真失败 / severity 10 仅信息」判据是否成立。
 * 只执行 RAISERROR(不写任何表)。
 */
public class RaiseProbe {
    public static void main(String[] args) throws Exception {
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            // 1) severity 16:期望抛 SQLException(=> DbSync runFile 判失败、不写 yj_schema_log)
            try (Statement st = c.createStatement()) {
                st.execute("RAISERROR(N'independent verify: deliberate severity 16', 16, 1);");
                System.out.println("[sev16] NO EXCEPTION (unexpected)");
            } catch (SQLException e) {
                System.out.println("[sev16] SQLException = " + e.getClass().getName()
                        + " | msg=" + e.getMessage().trim() + " | errorCode=" + e.getErrorCode());
            }
            // 2) severity 10:期望不抛异常,仅 SQLWarning 且 errorCode=50000(DbSync 白名单)
            try (Statement st = c.createStatement()) {
                st.execute("RAISERROR(N'[PASS] independent verify severity 10 info', 10, 1) WITH NOWAIT;");
                int cnt = 0;
                for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning()) {
                    cnt++;
                    System.out.println("[sev10] warning#" + cnt + " code=" + w.getErrorCode()
                            + " sqlState=" + w.getSQLState() + " msg=" + w.getMessage().trim());
                }
                System.out.println("[sev10] warnings=" + cnt);
                st.clearWarnings();
            } catch (SQLException e) {
                System.out.println("[sev10] SQLException (unexpected) = " + e.getMessage());
            }
            // 3) 批内「RAISERROR 不中止批次」现象:16 后仍执行后续 SELECT,但 JDBC 首错即抛
            try (Statement st = c.createStatement()) {
                boolean has = st.execute("RAISERROR(N'batch-continue-test', 16, 1); SELECT N'still-runs' AS x;");
                System.out.println("[sev16-in-batch] hasResultSet=" + has + " (no exception unexpected)");
            } catch (SQLException e) {
                System.out.println("[sev16-in-batch] SQLException as expected: " + e.getMessage().trim());
            }
        }
    }
}
