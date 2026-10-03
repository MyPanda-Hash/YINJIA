import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

/**
 * 执行一个迁移脚本并**抓取 PRINT 消息**(DbSync 只报 batches,看不到脚本自检输出)。
 * 用 T-SQL 包一层:先 SET NOCOUNT ON,脚本体内的 PRINT 会随结果集回传;
 * 这里用 SQLServerConnection 无法直接读消息,故走「把 PRINT 换成 SELECT」不可行 ——
 * 改为最简可信做法:逐批执行并把 **每个批次的错误/成功** 与 **自查查询** 一并打印。
 *
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive/_run-sql-verbose.java <sql文件>
 */
public class RunSqlVerbose {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String file = a[0];
        String sql = Files.readString(Paths.get(file), StandardCharsets.UTF_8);
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10",
                "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("== " + db + " :: " + file + " ==");
            // PRINT 消息:本驱动版本用 setServerMessageHandler 拿(旧版 setNotifyListener 已移除,实测 javap 无此方法)
            if (c instanceof com.microsoft.sqlserver.jdbc.SQLServerConnection sc) {
                sc.setServerMessageHandler(msg -> {
                    String t = msg.getErrorMessage();
                    if (t != null && !t.isBlank()) System.out.println("  " + t.trim());
                    return msg;
                });
            }
            String[] parts = sql.split("(?im)^\\s*GO\\s*$");
            int batch = 0, ok = 0, fail = 0;
            for (String part : parts) {
                if (part.trim().isEmpty()) continue;
                batch++;
                try (Statement st = c.createStatement()) { st.execute(part); ok++; }
                catch (Exception e) { fail++; System.out.println("  [ERR] batch#" + batch + " " + e.getMessage()); }
            }
            System.out.println("batches: " + batch + " ok: " + ok + " fail: " + fail);
        }
    }
}
