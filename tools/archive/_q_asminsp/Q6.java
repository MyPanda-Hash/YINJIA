import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** 一次性探针:对自检批次按"语句边界截断"定位失败语句。 */
public class Q6 {
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
        String f = batches.get(6).trim();          // 第 7 批 = F 自检
        String[] lines = f.split("\r?\n", -1);
        List<Integer> bounds = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            String t = lines[i].trim();
            if (t.startsWith("IF ") || t.startsWith("DECLARE") || t.startsWith("ELSE")) bounds.add(i);
        }
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (int b = 0; b < bounds.size(); b++) {
                int end = (b + 1 < bounds.size()) ? bounds.get(b + 1) : lines.length;
                String piece = String.join("\n", Arrays.copyOfRange(lines, 0, end));
                try (Statement st = c.createStatement()) {
                    st.execute(piece);
                    System.out.println("[OK  截到第 " + end + " 行]");
                } catch (SQLException e) {
                    System.out.println("[ERR 截到第 " + end + " 行] " + e.getMessage());
                    System.out.println("     新增语句起始行 " + (bounds.get(b) + 1) + ": " + lines[bounds.get(b)].trim());
                    break;
                }
            }
        }
    }
}
