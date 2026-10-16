import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;

/**
 * 只读探针:①清单 db-migrations.txt 与 yj_schema_log 的差集(未跑/哈希变更)
 *          ②在册表台账 db-inuse-tables.txt 与实际表清单的差集(缺表)
 * 用法(在 tools 目录下):java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_GapProbe.java [DB]
 */
public class _GapProbe {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Path base = Path.of(System.getProperty("user.dir"));
        List<String> manifest = new ArrayList<>();
        for (String line : Files.readAllLines(base.resolve("db-migrations.txt"), StandardCharsets.UTF_8)) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("#")) manifest.add(t);
        }
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("[connected] " + c.getCatalog() + " as " + c.getMetaData().getUserName());
            Map<String, String> log = new LinkedHashMap<>();
            Map<String, String> appliedAt = new LinkedHashMap<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT script_name, content_hash, CONVERT(varchar(19), applied_at, 120) FROM yj_schema_log")) {
                while (rs.next()) {
                    log.put(rs.getString(1), rs.getString(2) == null ? "" : rs.getString(2).trim());
                    appliedAt.put(rs.getString(1), rs.getString(3));
                }
            }
            List<String> never = new ArrayList<>(), changed = new ArrayList<>();
            int ok = 0;
            for (String s : manifest) {
                Path f = base.resolve(s);
                String h = sha256(f);
                String lh = log.get(s);
                if (lh == null) never.add(s);
                else if (!lh.equalsIgnoreCase(h)) changed.add(s);
                else ok++;
            }
            System.out.println("\n===== ① 清单 vs yj_schema_log (" + DB + ") =====");
            System.out.println("清单脚本数=" + manifest.size() + "  已登记且哈希一致=" + ok
                    + "  未登记(=从未跑)=" + never.size() + "  哈希变更(=需重跑)=" + changed.size()
                    + "  log 总行数=" + log.size());
            System.out.println("\n--- 未登记清单脚本(按清单顺序)---");
            for (String s : never) System.out.println("  [NEVER] " + s);
            System.out.println("\n--- 哈希变更(内容与上次执行时不同)---");
            for (String s : changed) System.out.println("  [CHANGED] " + s + "   applied_at=" + appliedAt.get(s));
            List<String> extra = new ArrayList<>(log.keySet());
            extra.removeAll(manifest);
            System.out.println("\n--- log 有、清单无(已移出清单的历史脚本)--- " + extra.size());
            for (String s : extra) System.out.println("  [EXTRA] " + s);

            // ② 在册表台账 vs 实际
            Set<String> actual = new TreeSet<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT name FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY name")) {
                while (rs.next()) actual.add(rs.getString(1));
            }
            List<String> inuse = new ArrayList<>();
            Path inuseFile = base.resolve("db-inuse-tables.txt");
            if (Files.exists(inuseFile)) {
                for (String line : Files.readAllLines(inuseFile, StandardCharsets.UTF_8)) {
                    String t = line.trim();
                    if (t.startsWith("table:")) inuse.add(t.substring(6).split("\\s")[0].trim());
                }
            }
            List<String> missing = new ArrayList<>(), notRegistered = new ArrayList<>();
            for (String t : inuse) if (!actual.contains(t)) missing.add(t);
            Set<String> inuseSet = new HashSet<>(inuse);
            for (String t : actual) if (!inuseSet.contains(t)) notRegistered.add(t);

            System.out.println("\n===== ② 在册表台账 vs 实际表 (" + DB + ") =====");
            System.out.println("在册登记=" + inuse.size() + "  库内实有(is_ms_shipped=0)=" + actual.size()
                    + "  台账有库里无=" + missing.size() + "  库里有台账无=" + notRegistered.size());
            System.out.println("\n--- 在册但库内缺失的表 ---");
            for (String t : missing) System.out.println("  [MISSING] " + t);
            System.out.println("\n--- 库内存在但台账未登记的表 ---");
            for (String t : notRegistered) System.out.println("  [UNREG] " + t);

            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0),"
                       + " (SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped=0),"
                       + " (SELECT COUNT(*) FROM yj_panel), (SELECT COUNT(*) FROM yj_field),"
                       + " (SELECT COUNT(*) FROM yj_user)")) {
                if (rs.next()) System.out.println("\n[总数] tables=" + rs.getInt(1) + " views=" + rs.getInt(2)
                        + " yj_panel=" + rs.getInt(3) + " yj_field=" + rs.getInt(4) + " yj_user=" + rs.getInt(5));
            }
        }
    }

    static String sha256(Path f) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
