import java.sql.*;

/** 临时探针(任务产物):跑一条 SQL 并按 TSV 打印结果,供检验人员口径取证。 */
public class _Q {
    public static void main(String[] args) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String sql = args.length > 0 && args[0].startsWith("@")
                ? new String(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(args[0].substring(1))), java.nio.charset.StandardCharsets.UTF_8)
                : args[0];
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            boolean has = st.execute(sql);
            while (true) {
                if (has) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) {
                            if (i > 1) h.append('\t');
                            h.append(m.getColumnLabel(i));
                        }
                        System.out.println(h);
                        int n = 0;
                        while (rs.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= m.getColumnCount(); i++) {
                                if (i > 1) b.append('\t');
                                Object v = rs.getObject(i);
                                b.append(v == null ? "<null>" : String.valueOf(v).replace("\t", " ").replace("\n", " "));
                            }
                            System.out.println(b);
                            n++;
                        }
                        System.out.println("-- rows: " + n);
                    }
                } else {
                    System.out.println("-- update: " + st.getUpdateCount());
                }
                has = st.getMoreResults();
                if (!has && st.getUpdateCount() == -1) break;
            }
        }
    }
}
