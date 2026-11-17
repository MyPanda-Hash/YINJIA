import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;

/**
 * _Q.java — 只读取证/查询工具(2026-11-15 生产工单追溯「工序计划数量应为换算后数量」任务)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar _Q.java HSDZ_MES  < sqlfile.sql [> out.txt]
 *   java -cp lib\mssql-jdbc.jar _Q.java HSDZ_MES  "<单条SQL>" [--db HSDZ_MES_TEST]
 *
 * 规则:每段以「-- @@ 标题」分隔(可选),多结果集逐个打印;参数化查询用 -- @@ 标题 后一段。
 * 密码取 env YINJIA_SQL_PASS,缺省 Yinjia@2026(开发机)。
 */
public class _Q {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String host = System.getenv().getOrDefault("YINJIA_SQL_HOST", "127.0.0.1");
        String url = "jdbc:sqlserver://" + host + ":1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        String sql;
        if (args.length > 1) {
            sql = args[1];
        } else {
            sql = Files.readString(Path.of("archive/_wo-trace-qty-20261115/_q.sql"), StandardCharsets.UTF_8);
            if (sql.isBlank()) sql = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
        }
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            // 按 "-- @@ " 切段
            String[] chunks = sql.split("(?m)^-- @@");
            for (String chunk : chunks) {
                String body = chunk.strip();
                if (body.isEmpty()) continue;
                int nl = body.indexOf('\n');
                String title = nl > 0 ? body.substring(0, nl).trim() : "";
                String stmt = nl > 0 ? body.substring(nl + 1) : body;
                if (stmt.isBlank()) continue;
                System.out.println();
                System.out.println("=== " + (title.isEmpty() ? "(query)" : title) + " ===");
                try (Statement st = c.createStatement()) {
                    boolean hasRs = st.execute(stmt);
                    int n = 0;
                    while (true) {
                        if (hasRs) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData md = rs.getMetaData();
                                int cols = md.getColumnCount();
                                StringBuilder h = new StringBuilder();
                                for (int i = 1; i <= cols; i++) h.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
                                System.out.println(h);
                                System.out.println("-".repeat(Math.min(h.length(), 200)));
                                while (rs.next()) {
                                    StringBuilder sb = new StringBuilder();
                                    for (int i = 1; i <= cols; i++) {
                                        Object v = rs.getObject(i);
                                        sb.append(i > 1 ? " | " : "").append(v == null ? "" : String.valueOf(v).trim());
                                    }
                                    System.out.println(sb);
                                    n++;
                                }
                            }
                            System.out.println("(" + n + " rows)");
                            n = 0;
                        } else {
                            int upd = st.getUpdateCount();
                            if (upd == -1) break;
                            System.out.println("(update count " + upd + ")");
                        }
                        hasRs = st.getMoreResults();
                    }
                } catch (SQLException e) {
                    System.out.println("[SQLSTATE=" + e.getSQLState() + " ERR=" + e.getErrorCode() + "] " + e.getMessage());
                }
            }
        }
    }
}
