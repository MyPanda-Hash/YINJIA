import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

/**
 * _q-db-state.java —— 合并后(2026-11-03)只读核对活库状态,不写任何数据。
 *
 * 背景:远端 c7cea084b 的提交说明称「migrate-wo-pick-line-20261101.sql 从来没登记进
 * tools/db-migrations.txt ⇒ 本机正式库 HSDZ_MES 也缺这张表」。合并后要确认
 * 「远端内容能不能在本机正常跑」,就得看这两条新登记的迁移在活库里到底跑没跑。
 *
 * 用法(JDK 11+ 单文件源码模式,密码可用 YINJIA_SQL_PASS 覆盖):
 *   java -cp tools\lib\mssql-jdbc.jar tools\archive\_merge-verify-20261103\_q-db-state.java
 */
public class DbStateProbe {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("connected: " + c.getCatalog() + " as " + c.getMetaData().getUserName());

            System.out.println("\n[表是否存在]");
            for (String t : new String[] { "wo_pick_doc", "wo_pick_line", "wo_pick_return", "wlbom_menu", "yj_schema_log" }) {
                System.out.println("  " + t + " = " + (objectExists(c, t) ? "存在" : "缺失"));
            }

            System.out.println("\n[sys.tables 里 wlbom 相关]");
            List<String> wl = queryList(c, "SELECT name FROM sys.tables WHERE name LIKE 'wlbom%' ORDER BY name");
            System.out.println("  " + (wl.isEmpty() ? "(无)" : String.join(", ", wl)));

            System.out.println("\n[yj_schema_log 是否登记了合并新带入的两条迁移]");
            for (String s : new String[] { "migrate-wo-pick-line-20261101.sql", "migrate-wo-pick-return-cleanup-20261030.sql" }) {
                PreparedStatement ps = c.prepareStatement("SELECT content_hash, applied_at FROM yj_schema_log WHERE script_name = ?");
                ps.setString(1, s);
                try (ResultSet rs = ps.executeQuery()) {
                    System.out.println("  " + s + " = " + (rs.next() ? "已登记 @" + rs.getString(2) : "未登记(脚本还没跑)"));
                }
            }

            System.out.println("\n[yj_schema_log 总行数]");
            System.out.println("  " + queryList(c, "SELECT COUNT(*) FROM yj_schema_log").get(0));
        }
    }

    static boolean objectExists(Connection c, String name) throws Exception {
        PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM sys.objects WHERE name = ?");
        ps.setString(1, name);
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    static List<String> queryList(Connection c, String sql) throws Exception {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }
}
