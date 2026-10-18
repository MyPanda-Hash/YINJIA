import java.nio.file.*;
import java.sql.*;

/** 一次性探针:跑一条 .sql(只读,GO 分批),逐结果集打印。用法:Q_run.java <db> <file.sql> */
public class Q_run {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String sql = Files.readString(Path.of(a[1]), java.nio.charset.StandardCharsets.UTF_8).replace("\uFEFF", "");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            for (String batch : sql.split("(?im)^\\s*GO\\s*$")) {
                if (batch.isBlank()) continue;
                try (Statement st = c.createStatement()) {
                    boolean has = st.execute(batch);
                    while (true) {
                        if (has) {
                            try (ResultSet rs = st.getResultSet()) {
                                ResultSetMetaData m = rs.getMetaData();
                                int n = m.getColumnCount();
                                StringBuilder h = new StringBuilder("  ");
                                for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
                                System.out.println(h);
                                while (rs.next()) {
                                    StringBuilder b = new StringBuilder("  ");
                                    for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                                    System.out.println(b);
                                }
                            }
                        } else {
                            int uc = st.getUpdateCount();
                            if (uc == -1) break;
                        }
                        has = st.getMoreResults();
                    }
                }
            }
        }
    }
}
