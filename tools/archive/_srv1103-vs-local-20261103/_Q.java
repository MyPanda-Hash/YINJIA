import java.io.*;
import java.sql.*;
/** 只读查询:java _Q.java <库名> "<SQL>"   默认连 127.0.0.1:1433 yinjia/Yinjia@2026 */
public class _Q {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String db = a[0];
        String sql = a[1];
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=15;queryTimeout=600";
        try (Connection c = DriverManager.getConnection(url, System.getenv().getOrDefault("QUSER","sa"), System.getenv().getOrDefault("QPASS","Yinjia@2026"));
             Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) { if (i > 1) h.append(" | "); h.append(m.getColumnLabel(i)); }
            out.println(h);
            out.println("----------");
            int rows = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) { if (i > 1) sb.append(" | "); String v = rs.getString(i); sb.append(v == null ? "" : v.trim()); }
                out.println(sb);
                rows++;
            }
            out.println("[" + rows + " rows]");
        }
    }
}
