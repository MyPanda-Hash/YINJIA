import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * 一次性只读查询器(首件检验单放开门禁的取证用,2026-10-20)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_first-insp-open-20261020\_Q.java <db> <sql文件>
 * 默认库 HSDZ_MES;只读,不写任何数据。
 */
public class _Q {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 && !args[0].isBlank() ? args[0] : "HSDZ_MES";
        Path sqlFile = Path.of(args.length > 1 ? args[1] : "q.sql");
        String sql = Files.readString(sqlFile);
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[db] " + c.getCatalog());
            for (String stmt : split(sql)) {
                String s = stmt.trim();
                if (s.isEmpty() || s.startsWith("--")) continue;
                long t0 = System.currentTimeMillis();
                System.out.println("\n=== " + oneLine(s) + " ===");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(s)) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    StringBuilder head = new StringBuilder();
                    for (int i = 1; i <= n; i++) head.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
                    System.out.println(head);
                    int rows = 0;
                    while (rs.next()) {
                        StringBuilder line = new StringBuilder();
                        for (int i = 1; i <= n; i++) {
                            Object v = rs.getObject(i);
                            line.append(i > 1 ? " | " : "").append(v == null ? "<null>" : String.valueOf(v).trim());
                        }
                        System.out.println(line);
                        rows++;
                        if (rows >= 80) { System.out.println("...(截断 80 行)"); break; }
                    }
                    System.out.println("[rows] " + rows + " in " + (System.currentTimeMillis() - t0) + "ms");
                }
            }
        }
    }

    private static String oneLine(String s) {
        String t = s.replaceAll("\\s+", " ");
        return t.length() <= 150 ? t : t.substring(0, 150) + " …";
    }

    /** 按单独一行的 GO 切分(脚本里 GO 独占一行) */
    private static List<String> split(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\\R")) {
            if (line.trim().equalsIgnoreCase("GO")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }
}
