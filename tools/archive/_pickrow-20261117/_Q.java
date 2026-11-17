import java.sql.*;

/** 一次性只读探针(_Q):按库名跑一条 SELECT 并逐行打印。用法: java _Q.java <db> "<sql>" */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement(); ResultSet rs = st.executeQuery(a[1])) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= n; i++) head.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
            System.out.println(head);
            int rows = 0;
            while (rs.next() && rows < 60) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) sb.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println(sb);
                rows++;
            }
            System.out.println("[rows printed=" + rows + "]");
        } catch (SQLException e) {
            System.out.println("ERR " + e.getMessage());
        }
    }
}
