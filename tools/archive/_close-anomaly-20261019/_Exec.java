import java.sql.*;

/** 一次性:在两个本地账套上跑一条 UPDATE/SELECT(验证用)。用法: _Exec <db> "<sql>" */
public class _Exec {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + a[0]
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(a[1]);
            if (hasRs) {
                try (ResultSet rs = st.getResultSet()) {
                    int n = rs.getMetaData().getColumnCount();
                    StringBuilder h = new StringBuilder();
                    for (int i = 1; i <= n; i++) h.append(rs.getMetaData().getColumnLabel(i)).append(i < n ? " | " : "");
                    System.out.println(h);
                    while (rs.next()) {
                        StringBuilder b = new StringBuilder();
                        for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                        System.out.println(b);
                    }
                }
            } else {
                System.out.println("UPDATED=" + st.getUpdateCount());
            }
        }
    }
}
