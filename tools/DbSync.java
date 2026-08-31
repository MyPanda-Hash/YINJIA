import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * YINJIA-MES 数据库增量同步(配合 git pull 使用,见 pull-sync.bat)。
 * 按清单 db-migrations.txt 的顺序,把「新增或内容有变化」的脚本执行到 HSDZ_MES,
 * 并在 yj_schema_log 记录脚本名 + 内容 SHA-256,下次未变化的直接跳过。
 *
 * 用法(在 tools 目录下):
 *   java -cp <mssql-jdbc.jar> DbSync.java                 增量同步(默认)
 *   java -cp <mssql-jdbc.jar> DbSync.java baseline        仅把清单中尚未记录的脚本标记为已执行(不动数据)
 *   java -cp <mssql-jdbc.jar> DbSync.java run <脚本名>     无视记录强制执行指定脚本(并记录)
 * 连接:默认 yinjia/Yinjia@2026@127.0.0.1:1433;密码可用环境变量 YINJIA_SQL_PASS 覆盖。
 *
 * 注意:脚本按批(GO)自动提交,中途失败可能部分生效——此时不写记录,修复后重跑即可(脚本幂等)。
 */
public class DbSync {
    /** SQL Server 提示类消息码(0=PRINT,5701=库上下文,5703/5704=语言,15477=sp_rename 注意事项),不算错误 */
    static final java.util.Set<Integer> INFO_CODES = java.util.Set.of(0, 5701, 5703, 5704, 15477);

    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "sync";
        Path base = Path.of(System.getProperty("user.dir"));
        Path manifest = base.resolve("db-migrations.txt");
        if (!Files.exists(manifest)) {
            System.err.println("[FATAL] 未找到清单 db-migrations.txt(应在 tools 目录下运行): " + manifest);
            System.exit(2);
        }
        List<String> scripts = readManifest(manifest);

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("[connected] " + c.getMetaData().getDatabaseProductName()
                    + " @ " + c.getCatalog() + " as " + c.getMetaData().getUserName());
            ensureLogTable(c);

            if (mode.equals("baseline")) {
                int marked = 0;
                for (String s : scripts) {
                    Path f = base.resolve(s);
                    if (!Files.exists(f)) { System.err.println("[缺失] " + s); continue; }
                    if (markApplied(c, s, sha256(f))) marked++;
                }
                System.out.println("=== baseline 完成: 新标记 " + marked + " 个脚本(数据库未改动)===");
                System.exit(0);
            }

            if (mode.equals("run")) {
                if (args.length < 2) { System.err.println("用法: DbSync run <脚本名>"); System.exit(2); }
                String s = args[1];
                Path f = base.resolve(s);
                if (!Files.exists(f)) { System.err.println("[FATAL] 脚本不存在: " + f); System.exit(2); }
                boolean ok = runFile(c, f);
                if (ok) markApplied(c, s, sha256(f));
                System.exit(ok ? 0 : 1);
            }

            if (!mode.equals("sync")) { System.err.println("[FATAL] 未知模式: " + mode); System.exit(2); }

            int ran = 0, skipped = 0, failed = 0;
            for (String s : scripts) {
                Path f = base.resolve(s);
                if (!Files.exists(f)) { System.err.println("[缺失] " + s); failed++; break; }
                String hash = sha256(f);
                String logged = loggedHash(c, s);
                if (logged != null && logged.equals(hash)) { skipped++; continue; }
                System.out.println(logged == null ? "[新增] " + s : "[变更] " + s + "(内容与上次执行时不同,重新执行)");
                if (runFile(c, f)) { markApplied(c, s, hash); ran++; }
                else { System.err.println("[SQL FAIL] " + s + " — 中止,后续脚本未执行"); failed++; break; }
            }
            System.out.println("=== 同步完成: 执行 " + ran + ", 跳过 " + skipped + ", 失败 " + failed + " ===");
            System.exit(failed > 0 ? 1 : 0);
        } catch (SQLException e) {
            System.err.println("[FATAL] " + e.getMessage());
            System.exit(1);
        }
    }

    static List<String> readManifest(Path manifest) throws Exception {
        List<String> out = new ArrayList<>();
        for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("#")) out.add(t);
        }
        return out;
    }

    static void ensureLogTable(Connection c) throws SQLException {
        try (Statement st = c.createStatement()) {
            st.execute("IF OBJECT_ID('yj_schema_log') IS NULL CREATE TABLE yj_schema_log ("
                    + "script_name nvarchar(300) PRIMARY KEY, "
                    + "content_hash char(64) NOT NULL, "
                    + "applied_at datetime2 DEFAULT SYSDATETIME())");
        }
    }

    static String loggedHash(Connection c, String script) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT content_hash FROM yj_schema_log WHERE script_name = ?")) {
            ps.setString(1, script);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    /** 已记录则更新哈希与时间,未记录则插入;返回是否为新插入 */
    static boolean markApplied(Connection c, String script, String hash) throws SQLException {
        try (PreparedStatement ins = c.prepareStatement(
                "INSERT INTO yj_schema_log (script_name, content_hash) SELECT ?, ? "
                + "WHERE NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = ?)")) {
            ins.setString(1, script);
            ins.setString(2, hash);
            ins.setString(3, script);
            if (ins.executeUpdate() > 0) return true;
        }
        try (PreparedStatement upd = c.prepareStatement(
                "UPDATE yj_schema_log SET content_hash = ?, applied_at = SYSDATETIME() WHERE script_name = ?")) {
            upd.setString(1, hash);
            upd.setString(2, script);
            upd.executeUpdate();
        }
        return false;
    }

    static String sha256(Path file) throws Exception {
        byte[] data = Files.readAllBytes(file);
        byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    static boolean runFile(Connection c, Path file) {
        System.out.println("== " + file.getFileName() + " ==");
        String raw;
        try {
            raw = Files.readString(file, StandardCharsets.UTF_8);
        } catch (Exception e) {
            System.err.println("  [读失败] " + e.getMessage());
            return false;
        }
        if (!raw.isEmpty() && raw.codePointAt(0) == 0xFEFF) raw = raw.substring(1);
        boolean hadError = false;
        try (Statement st = c.createStatement()) {
            int batches = 0;
            for (String batch : splitGo(raw)) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                st.execute(b);
                batches++;
                // 语句级错误(如建视图失败但批次继续)会以 SQLWarning 形式返回,必须检查,否则会静默漏建对象
                for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning()) {
                    if (!INFO_CODES.contains(w.getErrorCode())) {
                        // 白名单外非 0 码为真实错误(如 4502 列重复、207 列名无效)
                        System.err.println("  [语句错误] " + w.getMessage().trim() + " (code " + w.getErrorCode() + ")");
                        hadError = true;
                    } else if (w.getErrorCode() != 0) {
                        System.out.println("  [print] " + w.getMessage().trim());
                    }
                }
                st.clearWarnings();
                int u = st.getUpdateCount();
                if (u >= 0) System.out.println("  (" + u + " rows)");
            }
            if (hadError) { System.err.println("  [FAIL] " + file.getFileName() + " 有 " + batches + " 批,但部分语句报错,视为失败"); return false; }
            System.out.println("  [OK] " + batches + " batches");
            return true;
        } catch (SQLException e) {
            System.err.println("  [SQL失败] " + e.getMessage());
            return false;
        }
    }

    /** 按 GO 行切分(与 sqlcmd 一致) */
    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }
}
