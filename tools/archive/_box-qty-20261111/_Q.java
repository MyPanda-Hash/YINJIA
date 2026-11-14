import java.sql.*;

/**
 * _Q.java — 临时查询探针(本任务取证用,随任务提交到 tools/archive/)
 *
 * 用法(tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_box-qty-20261111\_Q.java "SELECT ..."
 *   库名用环境变量 YINJIA_SQL_DB 指定(默认 HSDZ_MES),连通口径与 DbSync 一致。
 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement s = c.createStatement()) {
            System.out.println("[DB] " + db);
            for (String sql : a) {
                System.out.println("== " + sql);
                try (ResultSet rs = s.executeQuery(sql)) {
                    ResultSetMetaData m = rs.getMetaData();
                    int n = m.getColumnCount();
                    StringBuilder head = new StringBuilder("   ");
                    for (int i = 1; i <= n; i++) head.append(m.getColumnLabel(i)).append(" | ");
                    System.out.println(head);
                    int rows = 0;
                    while (rs.next()) {
                        StringBuilder sb = new StringBuilder("   ");
                        for (int i = 1; i <= n; i++) sb.append(rs.getString(i)).append(" | ");
                        System.out.println(sb);
                        rows++;
                    }
                    System.out.println("   (" + rows + " rows)");
                }
            }
        }
    }
}
