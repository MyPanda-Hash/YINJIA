import java.sql.*;

/** 通用只读 SQL 探针:java -cp lib\mssql-jdbc.jar archive\_ProbeSql.java "<sql>" [库名] */
public class _ProbeSql {
    public static void main(String[] args) throws Exception {
        String sql = args.length > 0 ? args[0] : "SELECT 1";
        String db = args.length > 1 ? args[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
            System.out.println(head);
            int n = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(i > 1 ? "\t" : "").append(rs.getString(i));
                System.out.println(b);
                n++;
            }
            System.out.println("[rows] " + n);
        }
    }
}
