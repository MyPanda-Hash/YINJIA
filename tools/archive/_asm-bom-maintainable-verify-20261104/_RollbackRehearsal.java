import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * 事务内演练(一次性探针,2026-11-04):把迁移脚本在**不提交**的事务里跑一遍,
 * 再跑一遍证明幂等,最后跑断言脚本看结果,收尾 ROLLBACK ⇒ 数据库最终零改动。
 *
 * 为什么要这个:本机是开发库(两账套都有人/别的任务在用),迁移脚本在真跑之前
 * 先用「执行 + 断言 + 回滚」验证语法 / 幂等 / 自检口径,不动库。
 * 真跑(落库 + 写 yj_schema_log)仍由 DbSync run 执行(两账套),见 README.md。
 *
 * 用法(在 tools 目录):
 *   java -cp lib\mssql-jdbc.jar archive\_asm-bom-maintainable-verify-20261104\_RollbackRehearsal.java ^
 *        HSDZ_MES migrate-asm-bom-maintainable-20261104.sql archive\_asm-bom-maintainable-verify-20261104\CHECK-after.sql
 *
 * 参数:<库名> <迁移脚本路径> [断言脚本路径] [输出文件路径]
 * 连接:yinjia/Yinjia@2026 @ 127.0.0.1:1433;密码可用 YINJIA_SQL_PASS 覆盖。
 */
class _RollbackRehearsal {
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        PrintStream out = args.length > 3
                ? new PrintStream(new FileOutputStream(args[3]), true, StandardCharsets.UTF_8)
                : new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
        System.setOut(out);
        if (args.length < 2) {
            System.out.println("用法: java -cp lib\\mssql-jdbc.jar _RollbackRehearsal.java <库名> <迁移脚本> [断言脚本] [输出文件]");
            System.exit(2);
        }
        String db = args[0];
        Path mig = Path.of(args[1]);
        Path chk = args.length > 2 ? Path.of(args[2]) : null;
        if (!Files.exists(mig)) { out.println("[FATAL] 迁移脚本不存在: " + mig); System.exit(2); }
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", PASS)) {
            c.setAutoCommit(false);                       // 关键:整段演练不提交
            out.println("[connected] " + c.getMetaData().getDatabaseProductName()
                    + " @ " + c.getCatalog() + " as " + c.getMetaData().getUserName());
            out.println("[rehearsal] 全程在事务内,结束时 ROLLBACK(库不会变)");
            try (Statement st = c.createStatement()) {
                out.println();
                out.println("========== 第 1 遍:执行迁移脚本 ==========");
                run(st, Files.readString(mig, StandardCharsets.UTF_8));
                out.println();
                out.println("========== 第 2 遍:重跑迁移脚本(验证幂等:各段影响行数应全为 0)==========");
                run(st, Files.readString(mig, StandardCharsets.UTF_8));
                if (chk != null && Files.exists(chk)) {
                    out.println();
                    out.println("========== 断言:执行 " + chk.getFileName() + " ==========");
                    run(st, Files.readString(chk, StandardCharsets.UTF_8));
                }
            } catch (Exception e) {
                out.println("[EXCEPTION] " + e.getMessage());
                c.rollback();
                out.println("=== 已 ROLLBACK:数据库未改动 ===");
                System.exit(1);
            }
            int beforeRollback = scalarInt(c, "SELECT @@TRANCOUNT AS trancount");
            c.rollback();
            int afterRollback = scalarInt(c, "SELECT @@TRANCOUNT AS trancount");
            out.println();
            out.println("@@TRANCOUNT 回滚前 = " + beforeRollback + "(应 ≥ 1),回滚后 = " + afterRollback + "(应 0)");
            out.println("=== ROLLBACK 完成:本次演练未改动数据库(迁移真正落库请用 DbSync run)===");
        }
    }

    /** 按 GO 行切分,逐批执行,打印结果集 / PRINT 消息 / 批次数 —— 与 DbSync.runFile 同口径。 */
    static void run(Statement st, String script) throws SQLException {
        String raw = script;
        if (!raw.isEmpty() && raw.codePointAt(0) == 0xFEFF) raw = raw.substring(1);
        int batches = 0;
        for (String batch : splitGo(raw)) {
            String b = batch.trim();
            if (b.isEmpty()) continue;
            batches++;
            boolean hasRs = st.execute(b);
            do {
                if (hasRs) {
                    try (ResultSet rs = st.getResultSet()) {
                        printRs(rs);
                    }
                }
                hasRs = st.getMoreResults();
            } while (hasRs || st.getUpdateCount() != -1);
            for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning()) {
                String msg = w.getMessage() == null ? "" : w.getMessage().trim();
                if (!msg.isEmpty()) System.out.println("  [print] " + msg);
            }
            st.clearWarnings();
        }
        System.out.println("  [OK] " + batches + " batches(事务内)");
    }

    /** 取单值整数(用于 @@TRANCOUNT 证据) */
    static int scalarInt(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : -1;
        }
    }

    static void printRs(ResultSet rs) throws SQLException {        ResultSetMetaData md = rs.getMetaData();
        int n = md.getColumnCount();
        StringBuilder head = new StringBuilder();
        for (int i = 1; i <= n; i++) {
            if (i > 1) head.append(" | ");
            head.append(md.getColumnLabel(i));
        }
        System.out.println(head);
        System.out.println("-".repeat(Math.min(120, Math.max(10, head.length()))));
        int rows = 0;
        while (rs.next() && rows++ < 500) {
            StringBuilder line = new StringBuilder();
            for (int i = 1; i <= n; i++) {
                if (i > 1) line.append(" | ");
                Object v = rs.getObject(i);
                line.append(v == null ? "" : String.valueOf(v));
            }
            System.out.println(line);
        }
        System.out.println("(" + rows + " 行)");
    }

    /** 按 GO 行切分(与 sqlcmd / DbSync 一致) */
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
