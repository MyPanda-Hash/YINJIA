import java.sql.*;
import java.util.*;

/** 订单结转→工单 逻辑修正任务的取证探针(只读)。用法: java -cp lib\mssql-jdbc.jar _Q.java "SQL..." */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String sql : a) {
                System.out.println("=== " + sql);
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    StringBuilder h = new StringBuilder();
                    for (int i = 1; i <= n; i++) h.append(md.getColumnLabel(i)).append(i < n ? " | " : "");
                    System.out.println(h);
                    int rows = 0;
                    while (rs.next() && rows++ < 200) {
                        StringBuilder b = new StringBuilder();
                        for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                        System.out.println(b);
                    }
                } catch (SQLException e) {
                    System.out.println("[ERR] " + e.getMessage());
                }
            }
        }
    }
}
