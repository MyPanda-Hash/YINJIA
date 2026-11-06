import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.temporal.TemporalAccessor;

/**
 * 独立复核用只读导出器(一次性任务产物,不复用 lead 的 DumpSql.java)。
 * 用法: java -cp lib/mssql-jdbc.jar IDump.java <库名> <sql文件> <输出json>
 * 每个 GO 批次的第一个结果集输出为一行 JSON: {"batch":n,"columns":[...],"rows":[[...],...]}
 * 所有值按字符串输出(BigDecimal 用 toPlainString; 时间用 ISO-8601; null 用 JSON null),
 * 由 Python 端 json.loads 解析,避免 TSV 转义歧义。
 */
public class IDump {
    static String esc(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.toString();
    }

    static String value(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd.toPlainString();
        if (v instanceof Boolean b) return b.toString();
        if (v instanceof Timestamp ts) return ts.toLocalDateTime().toString();
        if (v instanceof java.sql.Date d) return d.toLocalDate().toString();
        if (v instanceof TemporalAccessor t) return t.toString();
        return String.valueOf(v);
    }

    public static void main(String[] args) throws Exception {
        String db = args[0], sqlFile = args[1], outFile = args[2];
        String sqlText = Files.readString(Path.of(sqlFile), StandardCharsets.UTF_8);
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        StringBuilder out = new StringBuilder();
        int batch = 0;
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            for (String sql : sqlText.split("(?m)^\\s*GO\\s*$")) {
                String s = sql.trim();
                if (s.isEmpty()) continue;
                batch++;
                try (Statement st = c.createStatement()) {
                    boolean has = st.execute(s);
                    int rsIdx = 0;
                    while (true) {
                        if (has) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData md = rs.getMetaData();
                                int n = md.getColumnCount();
                                StringBuilder line = new StringBuilder();
                                line.append("{\"batch\":").append(batch).append(",\"rs\":").append(rsIdx).append(",\"columns\":[");
                                for (int i = 1; i <= n; i++) {
                                    if (i > 1) line.append(',');
                                    line.append('"').append(esc(md.getColumnLabel(i))).append('"');
                                }
                                line.append("],\"rows\":[");
                                boolean first = true;
                                while (rs.next()) {
                                    if (!first) line.append(',');
                                    first = false;
                                    line.append('[');
                                    for (int i = 1; i <= n; i++) {
                                        if (i > 1) line.append(',');
                                        String v = value(rs.getObject(i));
                                        if (v == null) line.append("null");
                                        else line.append('"').append(esc(v)).append('"');
                                    }
                                    line.append(']');
                                }
                                line.append("]}");
                                out.append(line).append('\n');
                                rsIdx++;
                            }
                        } else {
                            out.append("{\"batch\":").append(batch).append(",\"rs\":-1,\"updateCount\":")
                               .append(st.getUpdateCount()).append("}\n");
                        }
                        has = st.getMoreResults();
                        if (!has && st.getUpdateCount() == -1) break;
                    }
                }
            }
        }
        Files.writeString(Path.of(outFile), out.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] batches=" + batch + " -> " + outFile);
    }
}
