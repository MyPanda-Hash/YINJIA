import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;

/** 只读:列出 db-migrations.txt 中「未登记」或「内容哈希已变」的脚本,不执行任何 SQL。 */
public class Pending {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        Path base = Path.of(".");
        int pending = 0, missing = 0, ok = 0;
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== " + db + " ===");
            for (String line : Files.readAllLines(base.resolve("db-migrations.txt"), StandardCharsets.UTF_8)) {
                String s = line.trim();
                if (s.isEmpty() || s.startsWith("#")) continue;
                Path f = base.resolve(s);
                if (!Files.exists(f)) { System.out.println("[缺失] " + s); missing++; continue; }
                String h = sha(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f)));
                String logged = null;
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT content_hash FROM yj_schema_log WHERE script_name = ?")) {
                    ps.setString(1, s);
                    try (ResultSet rs = ps.executeQuery()) { if (rs.next()) logged = rs.getString(1); }
                }
                if (logged == null) { System.out.println("[未登记] " + s); pending++; }
                else if (!logged.equals(h)) { System.out.println("[哈希变] " + s + " (" + logged.substring(0, 8) + " -> " + h.substring(0, 8) + ")"); pending++; }
                else ok++;
            }
            try (Statement st = c.createStatement()) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_schema_log")) {
                    if (rs.next()) System.out.println("yj_schema_log 行数 = " + rs.getInt(1));
                }
            }
            System.out.println("=== 已登记且一致 " + ok + " / 待执行 " + pending + " / 缺失 " + missing + " ===");
        }
    }

    static String sha(byte[] d) {
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
