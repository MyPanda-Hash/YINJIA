import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 迁移链差异只读探针(2026-11-13,报工记录查询区「输入即查」任务的取证脚本)。
 *
 * 回答一个问题:db-migrations.txt 清单与某个账套的 yj_schema_log 到底差哪几条
 * —— 未记录(会以 [新增] 重跑)与内容哈希不符(会以 [变更] 重跑)分别列出,
 * 用于判断"能不能安全地跑 DbSync sync"(历史脚本重放会撞 schema 演进,见 AGENTS.md)。
 *
 * 用法(在 tools 目录下,需 YINJIA_SQL_PASS 或默认口令):
 *   java -cp lib/mssql-jdbc.jar archive/_query-input-20261113/MigraDiff.java HSDZ_MES
 *   java -cp lib/mssql-jdbc.jar archive/_query-input-20261113/MigraDiff.java HSDZ_MES_TEST
 */
public class MigraDiff {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path base = Path.of(System.getProperty("user.dir")).getParent(); // tools 的上级 = 仓库根
        Path manifest = Path.of(System.getProperty("user.dir")).resolve("db-migrations.txt");
        List<String> scripts = new ArrayList<>();
        for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("#")) scripts.add(t);
        }
        Map<String, String> logged = new HashMap<>();
        try (Connection c = DriverManager.getConnection(URL + ";databaseName=" + db, USER, PASS);
             PreparedStatement ps = c.prepareStatement("SELECT script_name, content_hash FROM yj_schema_log");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) logged.put(rs.getString(1), rs.getString(2));
        }
        Set<String> missing = new LinkedHashSet<>();
        Set<String> changed = new LinkedHashSet<>();
        for (String s : scripts) {
            Path f = Path.of(System.getProperty("user.dir")).resolve(s);
            if (!Files.exists(f)) f = base.resolve(s);
            if (!Files.exists(f)) { missing.add("[文件缺失] " + s); continue; }
            String h = sha256(f);
            String old = logged.get(s);
            if (old == null) missing.add(s);
            else if (!old.equalsIgnoreCase(h)) changed.add(s);
        }
        System.out.println("[DB] " + db + "  清单 " + scripts.size() + " 条 / 记录 " + logged.size() + " 条");
        System.out.println("[未记录 = 会以 [新增] 执行] " + missing.size());
        for (String s : missing) System.out.println("  + " + s);
        System.out.println("[内容哈希不符 = 会以 [变更] 重跑] " + changed.size());
        for (String s : changed) System.out.println("  * " + s);
        // 记录里有、清单里没有的(历史遗留,无害但列出来)
        Set<String> orphan = new LinkedHashSet<>(logged.keySet());
        orphan.removeAll(scripts);
        System.out.println("[记录有、清单无] " + orphan.size());
        for (String s : orphan) System.out.println("  - " + s);
    }

    static String sha256(Path f) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
