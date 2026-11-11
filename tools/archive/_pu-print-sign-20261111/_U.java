import java.sql.*;

/**
 * _U.java — 临时写库探针(本任务收尾用:把验证时加进测试账套的"测试联系人A"清掉)
 *
 * 用法(tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_pu-print-sign-20261111\_U.java "UPDATE ..."
 * 库名用环境变量 YINJIA_SQL_DB(默认 HSDZ_MES);只跑 UPDATE/INSERT,不返回行。
 * ⚠ 只用于测试账套的验证数据收尾,不进迁移链。
 */
public class _U {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement s = c.createStatement()) {
            System.out.println("[DB] " + db);
            for (String sql : a) {
                System.out.println("== " + sql);
                int n = s.executeUpdate(sql);
                System.out.println("   影响行数 " + n);
            }
        }
    }
}
