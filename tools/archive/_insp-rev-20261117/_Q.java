import java.sql.*;

/** 一次性只读探针:跑一条 SELECT 并打印(检验委托单 2026-11-17 修订取证用)。
 *  用法:java -cp lib\mssql-jdbc.jar _Q.java "SELECT ..." [HSDZ_MES|HSDZ_MES_TEST] */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 1 ? a[1] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(a[0])) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    sb.append(m.getColumnLabel(i)).append('=').append(rs.getString(i));
                    if (i < n) sb.append(" | ");
                }
                System.out.println(sb);
            }
        }
    }
}
