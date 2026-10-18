import java.sql.*;
import java.nio.file.*;
import java.util.*;

/** 手工跑一支 SQL 脚本(按行首 GO 分批执行),用于**验证迁移脚本**是否可执行。
 *  与 DbSync 的区别:不写 yj_schema_log、不登记迁移链 —— 只是"跑一遍看结果"。
 *  用法: java -Dstdout.encoding=UTF-8 -cp "lib/mssql-jdbc.jar;archive/_diag-scan-report" _RunSql -f 脚本.sql
 *  库由 YINJIA_SQL_DB 覆盖(默认 HSDZ_MES)。 */
public class _RunSql {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String sql = new String(Files.readAllBytes(Paths.get(a[1])), "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        List<String> batches = new ArrayList<>();
        StringBuilder b = new StringBuilder();
        for (String line : sql.split("\\r?\\n")) {
            if (line.trim().equalsIgnoreCase("GO")) {
                String s = b.toString().trim();
                if (!s.isEmpty()) batches.add(s);
                b.setLength(0);
            } else b.append(line).append('\n');
        }
        if (!b.toString().trim().isEmpty()) batches.add(b.toString().trim());

        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            for (int i = 0; i < batches.size(); i++) {
                System.out.println("---- batch " + (i + 1) + " ----");
                try (Statement st = c.createStatement()) {
                    boolean has = st.execute(batches.get(i));
                    int guard = 0;
                    while (true) {
                        if (has) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData m = rs.getMetaData();
                                int n = m.getColumnCount();
                                StringBuilder h = new StringBuilder();
                                for (int k = 1; k <= n; k++) h.append(k > 1 ? "\t" : "").append(m.getColumnLabel(k));
                                System.out.println(h);
                                int rows = 0;
                                while (rs.next() && rows < 50) {
                                    StringBuilder r = new StringBuilder();
                                    for (int k = 1; k <= n; k++) {
                                        if (k > 1) r.append('\t');
                                        String v = rs.getString(k);
                                        r.append(v == null ? "" : v.replace("\t", " ").replace("\n", " "));
                                    }
                                    System.out.println(r);
                                    rows++;
                                }
                                if (rows == 50) System.out.println("(只显示前 50 行)");
                            }
                        } else {
                            System.out.println("updated=" + st.getUpdateCount());
                        }
                        if (!st.getMoreResults()) break;
                        has = true;
                        if (++guard > 20) break;
                    }
                }
            }
        }
        System.out.println("== 执行完成 ==");
    }
}
