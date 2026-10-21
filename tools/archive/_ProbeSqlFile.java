import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;

/** 通用只读 SQL 探针(从 UTF-8 文件读 SQL,避开命令行编码问题):
 *  java -cp lib\mssql-jdbc.jar archive/_ProbeSqlFile.java <file.sql> [库名] */
public class _ProbeSqlFile {
    public static void main(String[] args) throws Exception {
        String sql = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        String db = args.length > 1 ? args[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            boolean has = st.execute(sql);
            while (true) {
                if (has) {
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
                has = st.getMoreResults();
                if (!has && st.getUpdateCount() == -1) break;
            }
        }
    }
}
