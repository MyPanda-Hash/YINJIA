import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 只读查询器:把 SQL 文件(run.sql 同目录)打到指定库。用法:java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_Q.java <sql文件> [DB] */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 1 ? a[1] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String sql = Files.readString(Path.of(a[0]), StandardCharsets.UTF_8);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(sql);
            while (true) {
                if (hasRs) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
                        System.out.println(h);
                        System.out.println("-".repeat(Math.min(120, h.length())));
                        while (rs.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= m.getColumnCount(); i++) b.append(i > 1 ? " | " : "").append(rs.getString(i));
                            System.out.println(b);
                        }
                    }
                } else {
                    System.out.println("(update count: " + st.getUpdateCount() + ")");
                }
                for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning())
                    System.out.println("[msg] " + w.getMessage().trim());
                st.clearWarnings();
                if (!st.getMoreResults() && st.getUpdateCount() == -1) break;
                hasRs = true;
            }
        }
    }
}
