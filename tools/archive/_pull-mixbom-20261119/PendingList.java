import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;

/** 只读:把「未登记 / 哈希变」的脚本名按清单顺序写进 UTF-8 文本(供批量补迁移用)。 */
public class PendingList {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String outFile = a.length > 1 ? a[1] : "pending.txt";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        Path base = Path.of(".");
        StringBuilder sb = new StringBuilder();
        int pending = 0, ok = 0;
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String line : Files.readAllLines(base.resolve("db-migrations.txt"), StandardCharsets.UTF_8)) {
                String s = line.trim();
                if (s.isEmpty() || s.startsWith("#")) continue;
                Path f = base.resolve(s);
                if (!Files.exists(f)) continue;
                String h = sha(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f)));
                String logged = null;
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT content_hash FROM yj_schema_log WHERE script_name = ?")) {
                    ps.setString(1, s);
                    try (ResultSet rs = ps.executeQuery()) { if (rs.next()) logged = rs.getString(1); }
                }
                if (logged == null || !logged.equals(h)) { sb.append(s).append('\n'); pending++; }
                else ok++;
            }
        }
        Files.writeString(Path.of(outFile), sb.toString(), StandardCharsets.UTF_8);
        System.out.println(db + " -> " + outFile + " : pending=" + pending + " consistent=" + ok);
    }

    static String sha(byte[] d) {
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
