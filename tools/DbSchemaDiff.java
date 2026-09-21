import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * YINJIA-MES 离线库结构对比器(双库 JDBC 直连,只读)。
 *
 * 用途:部署前判断「服务器库到底缺哪些表/列/面板/字段」,以及部署后复核
 * 「服务器库是否已与开发机库同构」。只跑 SELECT,不做任何写入或 DDL。
 *
 * 用法:
 *   java -cp tools/lib/mssql-jdbc.jar tools/DbSchemaDiff.java \
 *        <参考库JDBC> <目标库JDBC> <用户> [密码|env]
 *
 * 例(本机自检 HSDZ_MES vs HSDZ_MES_TEST):
 *   java -cp tools/lib/mssql-jdbc.jar tools/DbSchemaDiff.java \
 *        "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" \
 *        "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" \
 *        yinjia env
 *
 * 输出:先打印各类差异,最后一行 RESULT: 汇总标记(供脚本判定,纯 ASCII):
 *   RESULT: IDENTICAL            目标库与参考库完全同构
 *   RESULT: DIFF-n              有 n 处差异(明细见上方)
 */
public class DbSchemaDiff {

    /** 参与对比的四类对象:SQL 一律只读 */
    /* 一律用 CONCAT:SQL Server 对 smallint + 字符串 的类型推断会报
       "在将 varchar 值 '|' 转换成数据类型 smallint 时失败"(实测踩过)。 */
    static final String Q_TABLES =
        "SELECT CONCAT(s.name, '.', t.name) AS k FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id";
    static final String Q_COLUMNS =
        "SELECT CONCAT(s.name, '.', t.name, '.', c.name, '|', ty.name, '|', c.max_length, '|', c.is_nullable, '|', c.is_identity) AS k "
      + "FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id JOIN sys.schemas s ON s.schema_id = t.schema_id "
      + "JOIN sys.types ty ON ty.user_type_id = c.user_type_id";
    static final String Q_VIEWS =
        "SELECT CONCAT(s.name, '.', v.name) AS k FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id";
    static final String Q_PANELS =
        "SELECT RTRIM(panel_code) AS k FROM yj_panel";
    static final String Q_FIELDS =
        "SELECT CONCAT(RTRIM(panel_code), '.', RTRIM(col_name)) AS k FROM yj_field";

    static Map<String, TreeSet<String>> snapshot(Connection c, String[] labels, String[] queries) throws Exception {
        Map<String, TreeSet<String>> out = new LinkedHashMap<>();
        for (int i = 0; i < labels.length; i++) {
            TreeSet<String> set = new TreeSet<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(queries[i])) {
                while (rs.next()) set.add(rs.getString(1));
            }
            out.put(labels[i], set);
        }
        return out;
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("用法: DbSchemaDiff <参考库JDBC> <目标库JDBC> <用户> <密码|env>");
            System.exit(2);
        }
        String refUrl = args[0], tgtUrl = args[1], user = args[2];
        String pass = args[3].equals("env") ? System.getenv("YINJIA_SQL_PASS") : args[3];
        if (pass == null) { System.err.println("[FATAL] 密码为空(env YINJIA_SQL_PASS 未设置)"); System.exit(2); }

        String[] labels = { "表", "列", "视图", "面板(yj_panel)", "面板字段(yj_field)" };
        String[] queries = { Q_TABLES, Q_COLUMNS, Q_VIEWS, Q_PANELS, Q_FIELDS };

        Map<String, TreeSet<String>> ref, tgt;
        String refName, tgtName;
        try (Connection c = DriverManager.getConnection(refUrl, user, pass)) {
            refName = c.getCatalog();
            ref = snapshot(c, labels, queries);
        }
        try (Connection c = DriverManager.getConnection(tgtUrl, user, pass)) {
            tgtName = c.getCatalog();
            tgt = snapshot(c, labels, queries);
        }

        System.out.println("[参考库] " + refName + "   [目标库] " + tgtName);
        System.out.println("(只读对比;差异 = 目标库相对参考库缺什么)");

        int total = 0;
        for (String label : labels) {
            TreeSet<String> r = ref.get(label), t = tgt.get(label);
            // 面板/字段两侧规模差异要单列,避免被表列差异淹没
            TreeSet<String> missing = new TreeSet<>(r); missing.removeAll(t);
            TreeSet<String> extra   = new TreeSet<>(t); extra.removeAll(r);

            System.out.println();
            System.out.println("=== " + label + " === 参考 " + r.size() + " / 目标 " + t.size()
                    + "  |  目标缺 " + missing.size() + "  目标多 " + extra.size());

            int shown = 0;
            for (String k : missing) {
                if (shown++ >= 40) { System.out.println("  ...(还有 " + (missing.size() - 40) + " 项,已截断)"); break; }
                System.out.println("  [缺] " + k);
            }
            shown = 0;
            for (String k : extra) {
                if (shown++ >= 20) { System.out.println("  ...(还有 " + (extra.size() - 20) + " 项,已截断)"); break; }
                System.out.println("  [多] " + k);
            }
            total += missing.size();
        }

        System.out.println();
        System.out.println(total == 0 ? "RESULT: IDENTICAL" : "RESULT: DIFF-" + total);
        System.exit(total == 0 ? 0 : 1);
    }
}
