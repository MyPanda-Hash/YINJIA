import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

// 一次性探针:按 GO 分批执行并在每批前打印编号+首行,失败时打印整批内容
public class _dbg {
    public static void main(String[] args) throws Exception {
        String raw = Files.readString(Paths.get(args[0]), StandardCharsets.UTF_8);
        if (raw.startsWith("\uFEFF")) raw = raw.substring(1);
        List<String> batches = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : raw.split("\r?\n", -1)) {
            String t = line.trim();
            if (t.toUpperCase(Locale.ROOT).matches("GO(\\s+.*)?") && t.matches("(?i)GO(\\s+\\d+)?")) {
                batches.add(cur.toString()); cur.setLength(0);
            } else cur.append(line).append('\n');
        }
        batches.add(cur.toString());
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=8",
                System.getenv("YINJIA_SQL_USER") == null ? "yinjia" : System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"));
             Statement st = c.createStatement()) {
            for (int i = 0; i < batches.size(); i++) {
                String b = batches.get(i).trim();
                if (b.isEmpty()) continue;
                String first = b.split("\r?\n", 2)[0];
                System.out.println("[batch " + (i + 1) + "] " + first.substring(0, Math.min(80, first.length())));
                try {
                    st.execute(b);
                } catch (SQLException e) {
                    System.out.println("[FAILED batch " + (i + 1) + "] " + e.getMessage());
                    System.out.println("---- batch content ----");
                    System.out.println(b);
                    return;
                }
            }
            System.out.println("[ALL OK] " + batches.size() + " batches");
        }
    }
}
