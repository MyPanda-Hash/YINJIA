import java.sql.*;
import java.io.PrintStream;

public class _q {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(System.out, true, java.nio.charset.StandardCharsets.UTF_8);
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass);
             Statement s = c.createStatement()) {
            for (String sql : a) {
                out.println("### " + db + " :: " + sql.substring(0, Math.min(120, sql.length())));
                boolean hasRs = s.execute(sql);
                while (hasRs || s.getUpdateCount() != -1) {
                    if (hasRs) {
                        ResultSet r = s.getResultSet();
                        ResultSetMetaData m = r.getMetaData();
                        int n = m.getColumnCount();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(" | ");
                        out.println(h);
                        while (r.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= n; i++) b.append(r.getString(i)).append(" | ");
                            out.println(b);
                        }
                    } else {
                        out.println("(" + s.getUpdateCount() + " rows affected)");
                    }
                    hasRs = s.getMoreResults();
                }
            }
        }
    }
}
