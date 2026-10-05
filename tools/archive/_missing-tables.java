import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;

/**
 * 在册表「账实核对」(只读):把 tools/db-inuse-tables.txt(在册台账)与实际库对比。
 *
 * 用途:回答「本地库到底缺哪些在册表」—— 拉取远端后,远端代码/迁移依赖的表若本机没有,
 *   迁移链会在半路报「找不到对象 dbo.xxx」;先跑本探针能一次看清缺口全貌,
 *   而不是被 DbSync 一条一条地撞出来。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_missing-tables.java [--extra]
 *   库名用环境变量 YINJIA_SQL_DB 覆盖(默认 HSDZ_MES);--extra 额外列出「库里有但不在册」的表。
 */
public class _missing_tables {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        boolean extra = Arrays.asList(args).contains("--extra");
        Path base = Path.of(System.getProperty("user.dir"));
        LinkedHashMap<String, String> registered = new LinkedHashMap<>();
        for (String raw : Files.readAllLines(base.resolve("db-inuse-tables.txt"), StandardCharsets.UTF_8)) {
            String t = raw.trim();
            if (!t.startsWith("table:")) continue;
            String rest = t.substring("table:".length()).trim();
            int hash = rest.indexOf('#');
            String name = (hash < 0 ? rest : rest.substring(0, hash)).trim();
            String note = hash < 0 ? "" : rest.substring(hash + 1).trim();
            if (!name.isEmpty()) registered.put(name, note);
        }

        Set<String> live = new LinkedHashSet<>();
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT name FROM sys.tables")) {
            while (rs.next()) live.add(rs.getString(1));
        }

        List<String> missing = new ArrayList<>();
        for (String n : registered.keySet()) if (!live.contains(n)) missing.add(n);

        System.out.println("=== 在册表账实核对 @" + DB + " ===");
        System.out.println("在册台账登记 : " + registered.size());
        System.out.println("实库表数     : " + live.size());
        System.out.println("实库缺失在册表: " + missing.size());
        System.out.println();
        if (missing.isEmpty()) {
            System.out.println("(无缺口:在册表全部存在于本库)");
        } else {
            System.out.println("--- 在册但本库不存在(远端依赖它们时迁移/运行会报「找不到对象」) ---");
            for (String n : missing) System.out.println("  ! " + n + (registered.get(n).isEmpty() ? "" : "   # " + registered.get(n)));
        }

        if (extra) {
            List<String> unregistered = new ArrayList<>();
            for (String n : live) if (!registered.containsKey(n)) unregistered.add(n);
            Collections.sort(unregistered);
            System.out.println();
            System.out.println("--- 库里有但不在册(" + unregistered.size() + ") ---");
            for (String n : unregistered) System.out.println("  ? " + n);
        }
    }
}
