import java.sql.*;
import java.nio.file.*;
import java.util.*;

/** 一次性只读探针:跑 SQL(文件可含多条语句,以行尾分号分隔)并打印结果(制表符分隔,首行=列名)。
 *  用法: java -Dstdout.encoding=UTF-8 -cp "lib/mssql-jdbc.jar;archive/_diag-scan-report" _Q -f 文件.sql
 *  库由 YINJIA_SQL_DB 覆盖(默认 HSDZ_MES)。 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String sql = a.length > 0 && !"-f".equals(a[0]) ? a[0] : new String(Files.readAllBytes(Paths.get(a[1])), "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            for (String stmt : split(sql)) {
                run(c, stmt);
            }
        }
    }

    static List<String> split(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder b = new StringBuilder();
        for (String line : sql.split("\\r?\\n")) {
            if (line.trim().startsWith("--")) continue;
            b.append(line).append('\n');
            if (line.trim().endsWith(";")) {
                String s = b.toString().trim();
                s = s.substring(0, s.length() - 1);
                if (!s.isBlank()) out.add(s);
                b.setLength(0);
            }
        }
        if (!b.toString().isBlank()) out.add(b.toString().trim());
        return out;
    }

    static void run(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement()) {
            boolean has = st.execute(sql);
            if (!has) { System.out.println("OK updated=" + st.getUpdateCount()); return; }
            try (ResultSet rs = st.getResultSet()) {
                ResultSetMetaData m = rs.getMetaData();
                int n = m.getColumnCount();
                StringBuilder h = new StringBuilder();
                for (int i = 1; i <= n; i++) h.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
                System.out.println(h);
                int rows = 0;
                while (rs.next()) {
                    StringBuilder b = new StringBuilder();
                    for (int i = 1; i <= n; i++) {
                        if (i > 1) b.append('\t');
                        String v = rs.getString(i);
                        b.append(v == null ? "" : v.replace("\t", " ").replace("\n", " ").replace("\r", " "));
                    }
                    System.out.println(b);
                    rows++;
                }
                System.out.println("-- rows=" + rows);
            }
        }
    }
}
