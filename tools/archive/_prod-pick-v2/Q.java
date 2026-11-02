import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 只读探针:逐条执行 SQL(以 GO 分批),把结果集打成 TSV。 */
public class Q {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName="
            + (a.length > 1 ? a[1] : "HSDZ_MES") + ";encrypt=false;loginTimeout=10";
        String sql = Files.readString(Path.of(a[0]), StandardCharsets.UTF_8).replace("\uFEFF", "");
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String batch : sql.split("(?im)^\\s*GO\\s*$")) {
                if (batch.isBlank()) continue;
                try (Statement st = c.createStatement()) {
                    boolean has = st.execute(batch);
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
                                        Object v = rs.getObject(i);
                                        String s = v == null ? "" : String.valueOf(v).replace('\t', ' ').replace('\n', ' ');
                                        if (s.length() > 220) s = s.substring(0, 220) + "…";
                                        r.append(i > 1 ? "\t" : "").append(s);
                                    }
                                    System.out.println(r);
                                }
                            }
                        } else {
                            int u = st.getUpdateCount();
                            if (u == -1) break;
                        }
                        has = st.getMoreResults();
                    }
                } catch (SQLException e) {
                    System.out.println("[ERR] " + e.getMessage());
                }
                System.out.println("---");
            }
        }
    }
}
