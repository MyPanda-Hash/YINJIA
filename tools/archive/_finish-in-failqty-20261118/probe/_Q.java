import java.sql.*;

/**
 * 通用 SQL 执行/查询探针(读写都行,供验收脚本调用):
 *   java -cp lib/mssql-jdbc.jar _Q.java "<sql>" [库名]
 * 输出:每个结果集先打表头 TSV,再逐行,最后一行 [rows] N;写语句打 [update] N。
 */
public class _Q {
    public static void main(String[] args) throws Exception {
        String sql = args.length > 0 ? args[0] : "SELECT 1";
        String db = args.length > 1 ? args[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(sql);
            while (true) {
                if (hasRs) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        StringBuilder head = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++)
                            head.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
                        System.out.println(head);
                        int n = 0;
                        while (rs.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= m.getColumnCount(); i++)
                                b.append(i > 1 ? "\t" : "").append(rs.getString(i));
                            System.out.println(b);
                            n++;
                        }
                        System.out.println("[rows] " + n);
                    }
                } else {
                    int u = st.getUpdateCount();
                    if (u == -1) break;
                    System.out.println("[update] " + u);
                }
                hasRs = st.getMoreResults();
            }
        }
    }
}
