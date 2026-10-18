import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * ExportCsv.java —— 把整库每张用户表导成一个 CSV(UTF-8 BOM,逗号分隔,带表头)。
 *
 * 用途:在**远程服务器**上把最新数据导出,打包带回本地,再按「备份 → 清空 → 导入」重建本地库。
 * 只读:只有 SELECT,不写任何表。
 *
 * 用法(在服务器上、仓库根目录):
 *   java -Dstdout.encoding=UTF-8 -cp "backend\target\classes;tools\lib\mssql-jdbc.jar" tools\archive\_remote-export-20261019\ExportCsv.java <输出目录> <库名> [--skip t1,t2]
 * 或(服务器上有 JDK 25 且能直接跑源码):
 *   java -Dstdout.encoding=UTF-8 -cp tools\lib\mssql-jdbc.jar tools\archive\_remote-export-20261019\ExportCsv.java D:\export\20261019 HSDZ_MES --skip dm_langue,gscs,permission,s_commdata,s_sys,s_xtcs
 *
 * 连接:默认 127.0.0.1:1433 / yinjia / Yinjia@2026;可用环境变量 YINJIA_SQL_USER / YINJIA_SQL_PASS 覆盖。
 * 输出:每表一个 <表名>.csv + _export-summary.txt(行数清单),整目录打包即可。
 */
public class ExportCsv {
    public static void main(String[] a) throws Exception {
        if (a.length < 2) {
            System.err.println("用法: ExportCsv <输出目录> <库名> [--skip t1,t2]");
            System.exit(2);
        }
        Path out = Path.of(a[0]);
        Files.createDirectories(out);
        String db = a[1];
        Set<String> skip = new HashSet<>();
        for (int i = 2; i < a.length; i++) {
            if ("--skip".equals(a[i]) && i + 1 < a.length) {
                for (String s : a[i + 1].split(",")) if (!s.isBlank()) skip.add(s.trim());
            }
        }
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[connected] " + c.getMetaData().getDatabaseProductName() + " @ " + c.getCatalog());
            List<String> tables = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT s.name + '.' + t.name FROM sys.tables t "
                                 + "JOIN sys.schemas s ON s.schema_id = t.schema_id "
                                 + "WHERE t.is_ms_shipped = 0 ORDER BY 1")) {
                while (rs.next()) tables.add(rs.getString(1));
            }
            StringBuilder summary = new StringBuilder("db=" + db + " tables=" + tables.size() + "\n");
            long total = 0;
            for (String full : tables) {
                String name = full.substring(full.indexOf('.') + 1);
                if (skip.contains(name)) {
                    System.out.println("SKIP " + name);
                    summary.append("SKIP\t").append(name).append('\n');
                    continue;
                }
                long rows = 0;
                Path f = out.resolve(name + ".csv");
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("SELECT * FROM " + full)) {
                    ResultSetMetaData md = rs.getMetaData();
                    int n = md.getColumnCount();
                    try (Writer w = new BufferedWriter(new OutputStreamWriter(
                            Files.newOutputStream(f), StandardCharsets.UTF_8))) {
                        w.write('\uFEFF');
                        for (int i = 1; i <= n; i++) {
                            if (i > 1) w.write(',');
                            w.write(q(md.getColumnLabel(i)));
                        }
                        w.write("\r\n");
                        while (rs.next()) {
                            for (int i = 1; i <= n; i++) {
                                if (i > 1) w.write(',');
                                String v = rs.getString(i);
                                if (v != null) w.write(q(v));
                            }
                            w.write("\r\n");
                            rows++;
                        }
                    }
                }
                total += rows;
                System.out.println(name + " rows=" + rows);
                summary.append(name).append('\t').append(rows).append('\n');
            }
            Files.writeString(out.resolve("_export-summary.txt"), summary.toString(), StandardCharsets.UTF_8);
            System.out.println("TOTAL rows=" + total + " dir=" + out.toAbsolutePath());
        }
    }

    static String q(String s) {
        if (s.indexOf(',') < 0 && s.indexOf('"') < 0 && s.indexOf('\n') < 0 && s.indexOf('\r') < 0) return s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
