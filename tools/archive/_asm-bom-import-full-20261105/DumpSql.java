import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 只读导出器(一次性任务产物):执行一个 SELECT,把结果集写成 TSV(无 500 行上限)。
 * 用法: java -cp lib/mssql-jdbc.jar DumpSql.java <库名> <sql文件> <输出tsv>
 * 环境变量 YINJIA_SQL_PASS 可覆盖密码;值内的 \t \r \n 转义为 \t \r \n,便于逐行比对。
 */
public class DumpSql {
    public static void main(String[] args) throws Exception {
        String db = args[0], sqlFile = args[1], outFile = args[2];
        String sqlText = Files.readString(Path.of(sqlFile), StandardCharsets.UTF_8);
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        StringBuilder out = new StringBuilder();
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            for (String sql : sqlText.split("(?m)^\s*GO\s*$")) {
                String s = sql.trim();
                if (s.isEmpty()) continue;
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(s)) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    StringBuilder head = new StringBuilder();
                    for (int i = 1; i <= n; i++) { if (i > 1) head.append('\t'); head.append(md.getColumnLabel(i)); }
                    out.append(head).append('\n');
                    long rows = 0;
                    while (rs.next()) {
                        StringBuilder line = new StringBuilder();
                        for (int i = 1; i <= n; i++) {
                            if (i > 1) line.append('\t');
                            Object v = rs.getObject(i);
                            if (v == null) continue;
                            String s2 = String.valueOf(v);
                            line.append(s2.replace("\\", "\\\\").replace("\t", "\t").replace("\r", "\r").replace("\n", "\n"));
                        }
                        out.append(line).append('\n');
                        rows++;
                    }
                    System.err.println("[OK] " + rows + " rows");
                }
            }
        }
        Files.writeString(Path.of(outFile), out.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] -> " + outFile);
    }
}
