import java.sql.*;

/** 测试用:执行任意 SQL(INSERT/UPDATE/DELETE/SELECT);SELECT 打印表头+行,其它打印 [update] 行数。 */
public class _ExecSql {
    public static void main(String[] args) throws Exception {
        String sql = args[0];
        String db = args.length > 1 ? args[1] : "HSDZ_MES_TEST";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(sql);
            if (hasRs) {
                try (ResultSet rs = st.getResultSet()) {
                    ResultSetMetaData m = rs.getMetaData();
                    StringBuilder head = new StringBuilder();
                    for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
                    System.out.println(head);
                    int n = 0;
                    while (rs.next()) {
                        StringBuilder b = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) b.append(i > 1 ? "\t" : "").append(rs.getString(i));
                        System.out.println(b);
                        n++;
                    }
                    System.out.println("[rows] " + n);
                }
            } else {
                System.out.println("[update] " + st.getUpdateCount());
            }
        }
    }
}
