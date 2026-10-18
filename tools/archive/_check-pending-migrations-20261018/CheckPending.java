import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;

/**
 * 只读体检:对比 tools/db-migrations.txt 与 yj_schema_log,列出
 *   ① 清单里有、日志里没有(= 从未执行)
 *   ② 日志里有、但文件内容 SHA-256 变了(= DbSync 下次会重跑)
 *   ③ 清单里有、文件却不在了
 *   ④ 日志里有、清单已移除
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_check-pending-migrations-20261018\CheckPending.java HSDZ_MES
 */
public class CheckPending {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        Path base = Path.of(System.getProperty("user.dir"));
        Path manifest = base.resolve("db-migrations.txt");
        List<String> entries = new ArrayList<>();
        for (String line : Files.readAllLines(manifest)) {
            String t = line.trim();
            if (t.isEmpty() || t.startsWith("#")) continue;
            if (t.toLowerCase(Locale.ROOT).endsWith(".sql")) entries.add(t);
        }
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        Map<String, String> log = new HashMap<>();
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT script_name, content_hash FROM dbo.yj_schema_log")) {
            while (rs.next()) log.put(rs.getString(1), rs.getString(2));
        }
        List<String> missing = new ArrayList<>(), changed = new ArrayList<>(), noFile = new ArrayList<>();
        for (String e : entries) {
            Path f = base.resolve(e);
            if (!Files.exists(f)) { noFile.add(e); continue; }
            String h = sha(f);
            String lh = log.get(e);
            if (lh == null) missing.add(e);
            else if (!lh.equalsIgnoreCase(h)) changed.add(e);
        }
        Set<String> inList = new HashSet<>(entries);
        List<String> extra = new ArrayList<>();
        for (String k : log.keySet()) if (!inList.contains(k)) extra.add(k);
        Collections.sort(missing); Collections.sort(changed); Collections.sort(extra); Collections.sort(noFile);
        System.out.println("DB=" + db + "  清单=" + entries.size() + "  日志=" + log.size());
        System.out.println("--- 未执行(不在日志) " + missing.size());
        for (String x : missing) System.out.println("  MISS " + x);
        System.out.println("--- 内容已变(下次会重跑) " + changed.size());
        for (String x : changed) System.out.println("  CHG  " + x);
        System.out.println("--- 清单有但文件缺失 " + noFile.size());
        for (String x : noFile) System.out.println("  NOFILE " + x);
        System.out.println("--- 日志有但清单已移除 " + extra.size());
        for (String x : extra) System.out.println("  EXTRA " + x);
    }

    static String sha(Path f) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
