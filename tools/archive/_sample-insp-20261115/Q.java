import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** 只读查询探针:java -cp tools/lib/mssql-jdbc.jar tools/archive/_sample-insp-20261115/Q.java <DB> <sqlFile> */
public class Q {
    public static void main(String[] args) throws Exception {
        String db = args[0];
        String sql = Files.readString(Path.of(args[1]), StandardCharsets.UTF_8);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(sql);
            int rsNo = 0;
            while (true) {
                if (hasRs) {
                    rsNo++;
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData md = rs.getMetaData();
                        int n = md.getColumnCount();
                        StringBuilder h = new StringBuilder("#" + rsNo);
                        for (int i = 1; i <= n; i++) h.append('\t').append(md.getColumnLabel(i));
                        System.out.println(h);
                        int rows = 0;
                        while (rs.next()) {
                            StringBuilder b = new StringBuilder();
                            for (int i = 1; i <= n; i++) {
                                if (i > 1) b.append('\t');
                                Object v = rs.getObject(i);
                                b.append(v == null ? "<null>" : String.valueOf(v).replace("\n", "\\n").replace("\r", ""));
                            }
                            System.out.println(b);
                            if (++rows > 5000) { System.out.println("... (truncated at 5000 rows)"); break; }
                        }
                        System.out.println("-- rows=" + rows);
                    }
                } else {
                    int uc = st.getUpdateCount();
                    if (uc == -1) break;
                    System.out.println("-- update count=" + uc);
                }
                hasRs = st.getMoreResults();
            }
        }
    }
}
