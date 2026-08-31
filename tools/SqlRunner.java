import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * YINJIA-MES SQL 脚本执行器(替代 sqlcmd;绕过本机损坏的 Schannel,纯 JDBC)。
 * 用法:
 *   java -cp <mssql-jdbc.jar> SqlRunner.java <jdbcUrl> <user> <pass> <file1.sql> [file2.sql ...]
 *   密码以 env YINJIA_SQL_PASS 传入时命令行第三个参数写 env:
 *   java ... SqlRunner.java <jdbcUrl> <user> env <file.sql>
 * 特性: UTF-8 BOM 兼容、按 GO 分批、PRINT 输出、遇错中止(退出码 1)。
 */
public class SqlRunner {
    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("用法: SqlRunner <jdbcUrl> <user> <pass|env> <sql...>");
            System.exit(2);
        }
        String url = args[0], user = args[1];
        String pass = args[2].equals("env") ? System.getenv("YINJIA_SQL_PASS") : args[2];
        boolean ok = true;
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[connected] " + c.getMetaData().getDatabaseProductName() + " "
                    + c.getMetaData().getDatabaseProductVersion() + " as " + c.getMetaData().getUserName());
            for (int f = 3; f < args.length && ok; f++) {
                ok = runFile(c, Path.of(args[f]));
            }
        } catch (SQLException e) {
            System.err.println("[FATAL] " + e.getMessage());
            System.exit(1);
        }
        System.exit(ok ? 0 : 1);
    }

    static boolean runFile(Connection c, Path file) {
        System.out.println("== " + file.getFileName() + " ==");
        String raw;
        try {
            raw = Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("[READ FAIL] " + e.getMessage());
            return false;
        }
        if (raw.startsWith("\uFEFF")) raw = raw.substring(1);
        List<String> batches = splitGo(raw);
        try (Statement st = c.createStatement()) {
            for (String batch : batches) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                boolean hasRs = st.execute(b);
                while (true) {
                    if (hasRs) {
                        try (ResultSet rs = st.getResultSet()) {
                            int cols = rs.getMetaData().getColumnCount();
                            int n = 0;
                            while (rs.next() && n < 50) {
                                StringBuilder sb = new StringBuilder("  | ");
                                for (int i = 1; i <= cols; i++) sb.append(rs.getString(i)).append(" | ");
                                System.out.println(sb);
                                n++;
                            }
                        }
                    } else {
                        int u = st.getUpdateCount();
                        if (u >= 0) System.out.println("  (" + u + " rows)");
                    }
                    if (!st.getMoreResults() && st.getUpdateCount() == -1) break;
                }
            }
            System.out.println("[OK] " + file.getFileName() + " (" + batches.size() + " batches)");
            return true;
        } catch (SQLException e) {
            System.err.println("[SQL FAIL] " + e.getMessage());
            return false;
        }
    }

    /** 按 GO 行切分(与 sqlcmd 一致;忽略大小写与行尾注释) */
    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            String t = line.trim();
            if (t.toUpperCase(Locale.ROOT).matches("GO(\\s+.*)?") && t.matches("(?i)GO(\\s+\\d+)?")) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(line).append('\n');
            }
        }
        out.add(cur.toString());
        return out;
    }
}
