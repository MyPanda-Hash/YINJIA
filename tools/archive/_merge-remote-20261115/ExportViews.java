import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 把正式库(HSDZ_MES)指定视图的定义原样导出成可在测试库执行的 SQL 文件。
 * 用法: java -cp tools/lib/mssql-jdbc.jar tools/archive/_merge-remote-20261115/ExportViews.java <输出文件> <视图名...>
 */
public class ExportViews {
    public static void main(String[] args) throws Exception {
        String out = args[0];
        List<String> names = new ArrayList<>(Arrays.asList(args).subList(1, args.length));
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        StringBuilder sb = new StringBuilder();
        sb.append("/* 由 HSDZ_MES 导出、在 HSDZ_MES_TEST 重建缺失视图(2026-11-15 测试库视图修复) */\n");
        sb.append("SET NOCOUNT ON;\nGO\n");
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            for (String n : names) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT m.definition FROM sys.views o JOIN sys.sql_modules m ON m.object_id = o.object_id WHERE o.name = ?")) {
                    ps.setString(1, n);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) { System.err.println("[SKIP] not found: " + n); continue; }
                        String def = rs.getString(1).trim();
                        sb.append("IF OBJECT_ID(N'dbo.").append(n).append("', N'V') IS NOT NULL EXEC(N'DROP VIEW [")
                          .append(n).append("]');\nGO\n").append(def).append("\nGO\n");
                        System.out.println("[OK] " + n + " (" + def.length() + " chars)");
                    }
                }
            }
        }
        Files.writeString(Path.of(out), sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[WROTE] " + out);
    }
}
