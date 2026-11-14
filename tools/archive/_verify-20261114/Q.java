import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/**
 * Q —— 验收用只读查询工具(2026-11-14 Lead 独立验收)。
 *
 * 用法(仓根,JDK 25):
 *   java -cp tools/lib/mssql-jdbc.jar tools/archive/_verify-20261114/Q.java <DB> <sqlFile>
 * 输出:每条 SELECT 以 '--- <SQL 前 60 字>' 开头,行用 ' | ' 拼接;无行则 '(0 rows)'。
 */
public class Q {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String sqlText = new String(Files.readAllBytes(Paths.get(a[1])), StandardCharsets.UTF_8);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("DB=" + db);
            for (String raw : sqlText.split(";\\s*\\n")) {
                // 去掉整行注释(块首的说明行),保留 SQL 本体
                StringBuilder body = new StringBuilder();
                for (String line : raw.split("\n")) {
                    if (!line.trim().startsWith("--")) body.append(line).append('\n');
                }
                String sql = body.toString().trim();
                if (sql.isEmpty()) continue;
                System.out.println("--- " + sql.replaceAll("\\s+", " ").substring(0, Math.min(70, sql.replaceAll("\\s+", " ").length())));
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    StringBuilder h = new StringBuilder();
                    for (int i = 1; i <= n; i++) h.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
                    System.out.println(h);
                    int rows = 0;
                    while (rs.next()) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = 1; i <= n; i++) sb.append(i > 1 ? " | " : "").append(rs.getString(i));
                        System.out.println(sb);
                        rows++;
                    }
                    if (rows == 0) System.out.println("(0 rows)");
                } catch (SQLException e) {
                    System.out.println("ERR=" + e.getMessage());
                }
            }
        }
    }
}
