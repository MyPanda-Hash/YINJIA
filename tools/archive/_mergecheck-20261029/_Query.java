import java.sql.*;
import java.util.*;

/** 只读探针:打印面板清单/字段数/迁移登记数,用于合并后冒烟核对。用法:java -cp lib/mssql-jdbc.jar archive/_mergecheck-20261029/_Query.java "<SQL>" */
public class _Query {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;user=yinjia;password=" + pass;
        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(a[0])) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(head);
            int n = 0;
            while (rs.next() && n++ < 60) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(rs.getString(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(sb);
            }
        }
    }
}
