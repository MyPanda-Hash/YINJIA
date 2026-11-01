import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** 通用只读探针:打印结果集列名与行(制表符分隔)。用法: java _Q.java <db> <file.sql> */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        String sql = Files.readString(Path.of(a[1]), StandardCharsets.UTF_8);
        if (sql.startsWith("\uFEFF")) sql = sql.substring(1);
        try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("[db=" + db + "]");
            for (String batch : sql.split("(?im)^\\s*GO\\s*$")) {
                for (String stmt : java.util.List.of(batch)) {
                    String s = stmt.trim();
                    if (s.isEmpty()) continue;
                    try (Statement st = c.createStatement()) {
                        boolean hasRs = st.execute(s);
                        while (true) {
                            if (hasRs) {
                                try (ResultSet rs = st.getResultSet()) {
                                    ResultSetMetaData md = rs.getMetaData();
                                    int n = md.getColumnCount();
                                    StringBuilder h = new StringBuilder();
                                    for (int i = 1; i <= n; i++) h.append(i > 1 ? "\t" : "").append(md.getColumnLabel(i));
                                    System.out.println(h);
                                    System.out.println("-".repeat(Math.min(120, h.length())));
                                    int rows = 0;
                                    while (rs.next()) {
                                        StringBuilder b = new StringBuilder();
                                        for (int i = 1; i <= n; i++) {
                                            Object v = rs.getObject(i);
                                            b.append(i > 1 ? "\t" : "").append(v == null ? "" : v.toString().trim());
                                        }
                                        System.out.println(b);
                                        if (++rows >= 2000) { System.out.println("... (超过 2000 行截断)"); break; }
                                    }
                                    System.out.println("[" + rows + " rows]");
                                }
                            } else {
                                int n = st.getUpdateCount();
                                if (n == -1) break;
                                System.out.println("(affected " + n + ")");
                            }
                            hasRs = st.getMoreResults();
                        }
                    }
                }
            }
        }
    }

    /** 以分号切分(忽略注释行与字符串内分号),够用于只读脚本。 */
    static List<String> splitStatements(String s) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inStr = false;
        String[] lines = s.split("\n");
        for (String line : lines) {
            String t = line.trim();
            if (!inStr && (t.startsWith("--") || t.isEmpty())) continue;
            for (int i = 0; i < line.length(); i++) {
                char ch = line.charAt(i);
                if (ch == '\'') inStr = !inStr;
                if (ch == ';' && !inStr) { out.add(cur.toString()); cur.setLength(0); continue; }
                cur.append(ch);
            }
            cur.append('\n');
        }
        if (!cur.toString().trim().isEmpty()) out.add(cur.toString());
        return out;
    }
}
