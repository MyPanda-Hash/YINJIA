import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

/**
 * 10.19 问题单排查用只读查询器(一次性探针)。
 * 用法: java -cp lib\mssql-jdbc.jar Q.java <库名> <sql文件|-> [分隔符]
 * 环境变量 YINJIA_SQL_PASS 可覆盖密码。
 */
public class Q {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String src = args.length > 1 ? args[1] : "-";
        String outFile = args.length > 2 ? args[2] : null;
        StringBuilder buf = new StringBuilder();
        java.io.PrintStream console = System.out;
        if (outFile != null) {
            System.setOut(new java.io.PrintStream(new java.io.FileOutputStream(outFile), true, StandardCharsets.UTF_8));
        }
        String sqlText = "-".equals(src)
                ? new String(System.in.readAllBytes(), StandardCharsets.UTF_8)
                : Files.readString(Path.of(src), StandardCharsets.UTF_8);
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            for (String sql : sqlText.split("(?m)^\\s*GO\\s*$")) {
                String s = sql.trim();
                if (s.isEmpty()) continue;
                System.out.println("==> " + s.replaceAll("\\s+", " ").trim());
                try (Statement st = c.createStatement()) {
                    boolean hasRs = st.execute(s);
                    if (hasRs) {
                        try (ResultSet rs = st.getResultSet()) {
                            ResultSetMetaData md = rs.getMetaData();
                            StringBuilder head = new StringBuilder();
                            for (int i = 1; i <= md.getColumnCount(); i++) {
                                if (i > 1) head.append(" | ");
                                head.append(md.getColumnLabel(i));
                            }
                            System.out.println(head);
                            System.out.println("-".repeat(Math.min(120, Math.max(10, head.length()))));
                            int n = 0;
                            while (rs.next() && n++ < 500) {
                                StringBuilder line = new StringBuilder();
                                for (int i = 1; i <= md.getColumnCount(); i++) {
                                    if (i > 1) line.append(" | ");
                                    Object v = rs.getObject(i);
                                    line.append(v == null ? "" : String.valueOf(v));
                                }
                                System.out.println(line);
                            }
                            System.out.println("(" + n + " 行)");
                        }
                    } else {
                        System.out.println("[" + st.getUpdateCount() + " 行受影响]");
                    }
                } catch (SQLException e) {
                    System.out.println("[ERR] " + e.getMessage());
                }
            }
        }
    }
}
