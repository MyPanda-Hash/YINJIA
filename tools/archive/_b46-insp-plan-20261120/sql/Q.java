import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;

/** 只读查询: java -cp tools/lib/mssql-jdbc.jar _scratch/b46/q/Q.java <db> <sql | @文件> [maxRows] */
public class Q {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String sql = a[1];
        if (sql.startsWith("@")) {
            sql = Files.readString(Path.of(sql.substring(1)), StandardCharsets.UTF_8);
        }
        int max = a.length > 2 ? Integer.parseInt(a[2]) : 200;
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            st.setMaxRows(max);
            boolean hasRs = st.execute(sql);
            int n = 0;
            while (true) {
                if (hasRs) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        int cols = m.getColumnCount();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= cols; i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
                        System.out.println(h);
                        while (rs.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= cols; i++) {
                                String v = rs.getString(i);
                                if (v != null) v = v.replace("\r", "\\r").replace("\n", "\\n");
                                b.append(i > 1 ? " | " : "").append(v == null ? "<NULL>" : v);
                            }
                            System.out.println(b);
                            n++;
                        }
                    }
                } else {
                    System.out.println("[rows affected] " + st.getUpdateCount());
                }
                hasRs = st.getMoreResults();
                if (!hasRs && st.getUpdateCount() == -1) break;
            }
            System.out.println("[rows=" + n + "]");
        }
    }
}
