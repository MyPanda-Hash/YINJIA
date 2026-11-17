import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 把测试库(HSDZ_MES_TEST)缺失/定义过旧的视图按**正式库(HSDZ_MES)的定义**重建。
 *
 * 背景(2026-11-15):测试库是正式库快照副本,部分报表视图停留在旧代(DISPATCHS 等列集不同);
 * 本次合并远端迁移后又发现 8 个视图在测试库缺失。逐视图 CREATE(TRY/CATCH 继续),
 * 失败的点名打印(通常是测试库基表缺列——那属于测试库结构陈旧,需要重建测试库才能根治)。
 *
 * 用法: java -cp tools/lib/mssql-jdbc.jar tools/archive/_merge-remote-20261115/RestoreViewsFromProd.java [--dry]
 */
public class RestoreViewsFromProd {
    static final String URL_PROD = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
    static final String URL_TEST = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        boolean dry = Arrays.asList(args).contains("--dry");
        LinkedHashMap<String, String> defs = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(URL_PROD, USER, PASS);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT o.name, m.definition FROM sys.views o JOIN sys.sql_modules m ON m.object_id = o.object_id "
                 + "WHERE o.is_ms_shipped = 0 ORDER BY o.name")) {
            while (rs.next()) defs.put(rs.getString(1), rs.getString(2).trim());
        }
        System.out.println("[prod views] " + defs.size());
        int ok = 0, fail = 0, skip = 0;
        List<String> failures = new ArrayList<>();
        try (Connection c = DriverManager.getConnection(URL_TEST, USER, PASS)) {
            Set<String> existing = new HashSet<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT name FROM sys.views WHERE is_ms_shipped = 0")) {
                while (rs.next()) existing.add(rs.getString(1));
            }
            try (Statement st = c.createStatement()) {
                for (Map.Entry<String, String> e : defs.entrySet()) {
                    String name = e.getKey();
                    String def = e.getValue();
                    String drop = "IF OBJECT_ID(N'dbo." + name + "', N'V') IS NOT NULL EXEC(N'DROP VIEW [" + name + "]')";
                    try {
                        if (!dry) {
                            st.execute(drop);
                            st.execute(def);
                        }
                        ok++;
                    } catch (SQLException ex) {
                        fail++;
                        failures.add(name + " :: " + ex.getMessage());
                        System.out.println("[FAIL] " + name + " :: " + ex.getMessage());
                        // 重建失败时尽量把原视图恢复回"测试库已有定义"(避免比修前更差)
                        if (existing.contains(name) && !dry) {
                            try {
                                st.execute(drop);
                            } catch (SQLException ignored) { }
                            System.out.println("        (已 drop,测试库该视图暂缺,需按失败原因处理)");
                        }
                    }
                }
            }
        }
        System.out.println("[result] ok=" + ok + " fail=" + fail + " skip=" + skip + (dry ? " (dry-run)" : ""));
        if (!failures.isEmpty()) {
            Files.write(Path.of("tools/archive/_merge-remote-20261115/view-restore-failures.txt"),
                    String.join(System.lineSeparator(), failures).getBytes(StandardCharsets.UTF_8));
        }
    }
}
