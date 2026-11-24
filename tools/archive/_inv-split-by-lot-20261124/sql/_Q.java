import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 临时只读探针:java _Q.java <db> <sqlFile>  —— 打印结果集(不写库)。 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String sql = a.length > 1 ? Files.readString(Path.of(a[1]), StandardCharsets.UTF_8) : new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
        if (!sql.isEmpty() && sql.charAt(0) == '\uFEFF') sql = sql.substring(1);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean has = st.execute(sql);
            int idx = 0;
            while (true) {
                if (has) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData md = rs.getMetaData();
                        int n = md.getColumnCount();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= n; i++) h.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
                        System.out.println("== RS" + (idx + 1) + " == " + h);
                        int r = 0;
                        while (rs.next() && r < 500) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= n; i++) b.append(i > 1 ? " | " : "").append(rs.getString(i));
                            System.out.println(b);
                            r++;
                        }
                        System.out.println("-- rows: " + r);
                    }
                } else {
                    System.out.println("updateCount=" + st.getUpdateCount());
                }
                idx++;
                has = st.getMoreResults();
                if (!has && st.getUpdateCount() == -1) break;
            }
        }
    }
}
