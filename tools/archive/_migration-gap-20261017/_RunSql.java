import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * _RunSql.java — 按 GO 分批执行一个 .sql 文件,并且**不写 yj_schema_log**
 * (区分于 DbSync.java run:那条路会往迁移登记表里插一行,本脚本是链外一次性脚本,不该污染登记表)。
 *
 * 用法(tools 目录):
 *   java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_RunSql.java <sql文件> [DB]
 */
public class _RunSql {
    static final Set<Integer> INFO_CODES = Set.of(0, 5701, 5703, 5704, 15477, 8153, 50000);

    public static void main(String[] a) throws Exception {
        if (a.length < 1) { System.err.println("用法: _RunSql <sql文件> [DB]"); System.exit(2); }
        String db = a.length > 1 ? a[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String file = a[0];
        String raw = Files.readString(Path.of(file), StandardCharsets.UTF_8);
        if (!raw.isEmpty() && raw.codePointAt(0) == 0xFEFF) raw = raw.substring(1);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            System.out.println("[connected] " + c.getCatalog());
            st.execute("SET NOCOUNT OFF");
            int batches = 0, errors = 0;
            for (String batch : splitGo(raw)) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                batches++;
                try {
                    boolean hasRs = st.execute(b);
                    while (true) {
                        if (hasRs) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData m = rs.getMetaData();
                                StringBuilder h = new StringBuilder();
                                for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
                                System.out.println(h);
                                while (rs.next()) {
                                    StringBuilder sb = new StringBuilder();
                                    for (int i = 1; i <= m.getColumnCount(); i++) sb.append(i > 1 ? " | " : "").append(rs.getString(i));
                                    System.out.println(sb);
                                }
                            }
                        } else {
                            int u = st.getUpdateCount();
                            if (u > 0) System.out.println("  (" + u + " rows)");
                        }
                        for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning()) {
                            String msg = w.getMessage() == null ? "" : w.getMessage().trim();
                            if (!msg.isEmpty() && (INFO_CODES.contains(w.getErrorCode()) || w.getErrorCode() != 0)) {
                                if (w.getErrorCode() == 0 || INFO_CODES.contains(w.getErrorCode())) System.out.println("  [msg] " + msg);
                            }
                        }
                        st.clearWarnings();
                        if (!st.getMoreResults() && st.getUpdateCount() == -1) break;
                        hasRs = true;
                    }
                } catch (SQLException e) {
                    errors++;
                    System.err.println("  [批 " + batches + " 失败] " + e.getMessage());
                }
            }
            System.out.println("=== " + Path.of(file).getFileName() + " @ " + db + ": 批 " + batches + ", 失败 " + errors + " ===");
            System.exit(errors > 0 ? 1 : 0);
        }
    }

    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }
}
