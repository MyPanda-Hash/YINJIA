import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/** Export local zh-TW translations + locale row as tw-sync.sql for remote execution. */
public class _ExportTW {
    static final String URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = "Yinjia@2026";

    public static void main(String[] args) throws Exception {
        StringBuilder sb = new StringBuilder();
        sb.append("SET NOCOUNT ON;\n");
        sb.append("IF NOT EXISTS (SELECT 1 FROM yj_locale WHERE locale='zh-TW')\n");
        sb.append("    INSERT INTO yj_locale (locale, name_zh, name_native, enabled, sort) VALUES (N'zh-TW', N'简体中文', N'繁體中文', 1, 100);\n");
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             PreparedStatement ps = c.prepareStatement(
                     "SELECT scope, ref_key, text FROM yj_translation WHERE locale = 'zh-TW' ORDER BY scope, ref_key")) {
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) {
                    String scope = rs.getString(1), key = rs.getString(2), text = rs.getString(3);
                    if (text == null) continue;
                    sb.append("IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope=N'").append(esc(scope))
                            .append("' AND ref_key=N'").append(esc(key)).append("' AND locale=N'zh-TW')\n");
                    sb.append("    INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at) VALUES (N'")
                            .append(esc(scope)).append("', N'").append(esc(key)).append("', N'zh-TW', N'")
                            .append(esc(text)).append("', N'mt', SYSDATETIME(), SYSDATETIME());\n");
                    n++;
                }
                System.out.println("rows=" + n);
            }
        }
        Files.write(Path.of("C:/INCER/deploy/tw-sync.sql"), sb.toString().getBytes(StandardCharsets.UTF_8));
        System.out.println("written tw-sync.sql bytes=" + sb.length());
    }

    static String esc(String s) {
        return s.replace("'", "''");
    }
}
