import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;

/**
 * 迁移预检(只读,不碰库):算出下一次 DbSync 会「新增」还是「重跑」哪些脚本。
 *
 * 用途:拉取远端后、跑 DbSync 之前先看清爆炸半径 ——
 *   ① 未登记(net new)= 远端本轮新增的迁移,正常要跑;
 *   ② 内容已变(会重跑)= 远端改了**已执行过的**历史脚本的字节 ⇒ DbSync 按内容哈希
 *      判定为「要跑」,历史脚本重跑会撞 schema 演进(AGENTS.md「迁移链卫生」的踩坑点),
 *      必须逐条确认是不是远端有意修订(远端自己已重跑过)才能放行;
 *   ③ 文件缺失 = 清单里有、文件不在(会报错)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_pending-migrations.java
 *   库名用环境变量 YINJIA_SQL_DB 覆盖(默认 HSDZ_MES)。
 */
public class _pending_migrations {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        Path base = Path.of(System.getProperty("user.dir"));
        Path manifest = base.resolve("db-migrations.txt");
        List<String> scripts = new ArrayList<>();
        for (String raw : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            String t = raw.trim();
            if (!t.isEmpty() && !t.startsWith("#")) scripts.add(t);
        }

        Map<String, String> logged = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT script_name, content_hash FROM yj_schema_log")) {
            while (rs.next()) {
                String n = rs.getString(1);
                String h = rs.getString(2);
                if (n != null && h != null) logged.put(n.trim(), h.trim().toLowerCase());
            }
        }

        List<String> fresh = new ArrayList<>(), changed = new ArrayList<>(), missing = new ArrayList<>();
        int same = 0;
        for (String s : scripts) {
            Path f = base.resolve(s);
            if (!Files.exists(f)) { missing.add(s); continue; }
            String h = sha256(f);
            String lh = logged.get(s);
            if (lh == null) fresh.add(s);
            else if (lh.equals(h)) same++;
            else changed.add(s);
        }

        System.out.println("=== 迁移预检 @" + DB + " ===");
        System.out.println("清单条数        : " + scripts.size());
        System.out.println("库内已登记      : " + logged.size());
        System.out.println("哈希一致(跳过) : " + same);
        System.out.println("未登记(新增)   : " + fresh.size());
        System.out.println("内容已变(重跑) : " + changed.size());
        System.out.println("文件缺失        : " + missing.size());

        System.out.println("\n--- 未登记,将按新增执行 ---");
        for (String s : fresh) System.out.println("  + " + s);
        System.out.println("\n--- 内容已变,将被重跑(需确认远端是否有意修订) ---");
        for (String s : changed) System.out.println("  ~ " + s);
        if (!missing.isEmpty()) {
            System.out.println("\n--- 文件缺失 ---");
            for (String s : missing) System.out.println("  ! " + s);
        }
    }

    static String sha256(Path f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] d = md.digest(Files.readAllBytes(f));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
