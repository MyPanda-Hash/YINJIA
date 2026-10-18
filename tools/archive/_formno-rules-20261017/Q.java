import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 一次性探针:跑一个 SQL 脚本,全部行原样 TSV 输出(不截断)。 */
public class Q {
    public static void main(String[] a) throws Exception {
        String url = a[0], user = a[1], pass = a[2], file = a[3];
        String sql = Files.readString(Path.of(file), StandardCharsets.UTF_8);
        if (sql.startsWith("\uFEFF")) sql = sql.substring(1);
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            for (String batch : sql.split("(?m)^\\s*GO\\s*$")) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                boolean has = st.execute(b);
                while (true) {
                    if (has) {
                        try (ResultSet rs = st.getResultSet()) {
                            if (rs != null) {
                                ResultSetMetaData m = rs.getMetaData();
                                StringBuilder h = new StringBuilder();
                                for (int i = 1; i <= m.getColumnCount(); i++) {
                                    if (i > 1) h.append('\t');
                                    h.append(m.getColumnLabel(i));
                                }
                                System.out.println(h);
                                while (rs.next()) {
                                    StringBuilder sb = new StringBuilder();
                                    for (int i = 1; i <= m.getColumnCount(); i++) {
                                        if (i > 1) sb.append('\t');
                                        Object v = rs.getObject(i);
                                        sb.append(v == null ? "" : String.valueOf(v).replace('\t', ' '));
                                    }
                                    System.out.println(sb);
                                }
                            }
                        }
                    } else {
                        System.out.println("[update] " + st.getUpdateCount());
                    }
                    has = st.getMoreResults();
                    if (!has && st.getUpdateCount() == -1) break;
                }
            }
        }
    }
}
