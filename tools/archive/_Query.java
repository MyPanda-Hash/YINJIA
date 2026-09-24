import java.sql.*;

/**
 * 一次性探针:执行任意只读 SQL 并以竖线分隔输出。
 * 用法: java -cp <jdbc.jar> _Query.java "<jdbcUrl>" <user> <pass> "<sql>" [--grid]
 * 仅用于查询参考库/元数据,不做任何写入。
 */
public class _Query {
    public static void main(String[] args) throws Exception {
        String url = args[0], user = args[1], pass = args[2], sql = args[3];
        boolean header = true;
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            try (Statement st = c.createStatement()) {
                boolean has = st.execute(sql);
                while (true) {
                    if (has) {
                        try (ResultSet rs = st.getResultSet()) {
                            ResultSetMetaData md = rs.getMetaData();
                            int n = md.getColumnCount();
                            StringBuilder h = new StringBuilder();
                            for (int i = 1; i <= n; i++) {
                                if (i > 1) h.append(" | ");
                                h.append(md.getColumnLabel(i));
                            }
                            if (header) System.out.println(h);
                            int rows = 0;
                            while (rs.next()) {
                                StringBuilder b = new StringBuilder();
                                for (int i = 1; i <= n; i++) {
                                    if (i > 1) b.append(" | ");
                                    String v = rs.getString(i);
                                    if (v != null) v = v.replace("\r", "\\r").replace("\n", "\\n");
                                    b.append(v);
                                }
                                System.out.println(b);
                                rows++;
                            }
                            System.out.println("-- (" + rows + " rows) --");
                        }
                    } else {
                        int u = st.getUpdateCount();
                        if (u == -1) break;
                        System.out.println("-- updated " + u + " --");
                    }
                    has = st.getMoreResults();
                }
            }
        }
    }
}
