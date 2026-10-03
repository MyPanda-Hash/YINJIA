import java.sql.*;
import java.nio.file.*;

/**
 * 只读探针:导出四个库存视图的完整定义(供整理《库存表清单》用)。
 *
 * 为什么要用 JDBC 而不是 sqlcmd:视图定义含中文列名且很长,而 sqlcmd 的 -W 与 -y/-h 互斥
 * (实测报「Sqlcmd: -W 和 -y 选项互斥」),取不到全文本。JDBC 一次取净、编码可控。
 *
 * 用法(仓库根目录):
 *   java -cp tools\lib\mssql-jdbc.jar tools\archive\_dump-stock-view-defs.java
 * 输出默认落在**当前目录**,可用 -Dout=&lt;目录&gt; 覆盖;口令取环境变量 YINJIA_SQL_PASS。
 */
public class Qv {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    // 默认当前目录:不要往仓库里写临时产物(原默认写 _scratch/,任务收尾被清理后该路径即失效)
    static final String OUT = System.getProperty("out", ".");

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            for (String v : new String[]{"v_stock_movement", "v_stock_balance", "v_stock_ledger", "v_stock_summary"}) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID(?)")) {
                    ps.setString(1, "dbo." + v);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            String def = rs.getString(1);
                            Path p = Path.of(OUT, v + ".sql");
                            Files.writeString(p, def, java.nio.charset.StandardCharsets.UTF_8);
                            System.out.println(v + " -> " + p + " (" + def.length() + " chars)");
                        } else {
                            System.out.println(v + " -> (定义取不到)");
                        }
                    }
                }
            }
        }
    }
}
