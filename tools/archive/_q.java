import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

// 一次性探针:跑一个 SQL 文件并把结果集写进 outPath(UTF-8 无 BOM),用法:
//   java -cp ".;jdbc.jar" _q query.sql [dbName] [outPath]
// 口令经 env YINJIA_SQL_PASS 传入(不入库;同 SqlRunner.java 惯例)
public class _q {
    public static void main(String[] args) throws Exception {
        Path out = Paths.get(args.length > 2 ? args[2] : args[0] + ".out");
        PrintStream so = new PrintStream(Files.newOutputStream(out), true, "UTF-8");
        System.setOut(so);
        String sql = Files.readString(Paths.get(args[0]), StandardCharsets.UTF_8).replace("\uFEFF", "");
        String db = args.length > 1 && !args[1].startsWith("-") ? args[1] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, System.getenv("YINJIA_SQL_USER") == null ? "yinjia" : System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"));
             Statement st = c.createStatement()) {
            boolean hasRs = st.execute(sql);
            int updates = 0;
            while (true) {
                if (hasRs) {
                    try (ResultSet rs = st.getResultSet()) {
                        ResultSetMetaData m = rs.getMetaData();
                        StringBuilder h = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? "|" : "").append(m.getColumnLabel(i));
                        System.out.println(h);
                        while (rs.next()) {
                            StringBuilder r = new StringBuilder();
                            for (int i = 1; i <= m.getColumnCount(); i++) r.append(i > 1 ? "|" : "").append(rs.getString(i));
                            System.out.println(r);
                        }
                    }
                } else {
                    int n = st.getUpdateCount();
                    if (n == -1) break;
                    updates += n;
                }
                hasRs = st.getMoreResults();
            }
            if (updates > 0) System.out.println("-- updates: " + updates);
            so.flush(); so.close();
        }
    }
}
