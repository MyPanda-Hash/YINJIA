import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** 一次性探针:按 DbSync 的 GO 切分复跑迁移脚本,再对失败批次做前缀二分定位。 */
public class Q5 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String raw = Files.readString(Path.of(args[0]), StandardCharsets.UTF_8);
        List<String> batches = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : raw.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { batches.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        batches.add(cur.toString());
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (int i = 0; i < batches.size(); i++) {
                String b = batches.get(i).trim();
                if (b.isEmpty()) continue;
                try (Statement st = c.createStatement()) {
                    st.execute(b);
                    System.out.println("[OK  batch " + (i + 1) + "]");
                } catch (SQLException e) {
                    System.out.println("[ERR batch " + (i + 1) + "] " + e.getMessage());
                    // 前缀二分:按行逐步加长,找到第一行导致失败的语句
                    String[] lines = b.split("\r?\n", -1);
                    String lastOk = "";
                    for (int n = 1; n <= lines.length; n++) {
                        String prefix = String.join("\n", Arrays.copyOfRange(lines, 0, n));
                        try (Statement st2 = c.createStatement()) {
                            st2.execute(prefix);
                            lastOk = prefix;
                        } catch (SQLException e2) {
                            System.out.println("  -> 首个失败前缀结束于第 " + n + " 行: " + lines[n - 1].trim());
                            System.out.println("  -> " + e2.getMessage());
                            System.out.println("  ---- 上一段可执行前缀的最后 6 行 ----");
                            String[] ok = lastOk.split("\r?\n", -1);
                            for (int k = Math.max(0, ok.length - 6); k < ok.length; k++) System.out.println("     | " + ok[k]);
                            break;
                        }
                    }
                }
            }
        }
    }
}
