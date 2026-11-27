import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;

/** 一次性只读查询器:读 UTF-8 SQL 文件,逐结果集打印 TSV。用法: _Q.java <file.sql> [db] */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 1 ? a[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String sql = Files.readString(Path.of(a[0]), StandardCharsets.UTF_8);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            for (String stmt : sql.split("(?m)^\\s*GO\\s*$")) {
                if (stmt.isBlank()) continue;
                try (Statement st = c.createStatement()) {
                    boolean has = st.execute(stmt);
                    while (true) {
                        if (has) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData m = rs.getMetaData();
                                int n = m.getColumnCount();
                                StringBuilder h = new StringBuilder();
                                for (int i = 1; i <= n; i++) h.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
                                System.out.println(h);
                                while (rs.next()) {
                                    StringBuilder r = new StringBuilder();
                                    for (int i = 1; i <= n; i++) {
                                        String v = rs.getString(i);
                                        r.append(i > 1 ? "\t" : "").append(v == null ? "<null>" : v.replace("\n", "\\n"));
                                    }
                                    System.out.println(r);
                                }
                            }
                        } else {
                            int uc = st.getUpdateCount();
                            if (uc == -1) break;
                            System.out.println("[update " + uc + "]");
                        }
                        has = st.getMoreResults();
                    }
                }
            }
        }
    }
}
