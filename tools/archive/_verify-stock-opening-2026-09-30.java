import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 只读/半只读探针:库存三表结构「期初建账单」(任务 2)的验证工具。
 *
 * 为什么需要它(而不是 DbSync / sqlcmd):
 *   ① DbSync 只回显白名单外非 0 错误码的 SQLWarning —— 脚本里的 `PRINT`(错误码 0)被静默吞掉,
 *      所以「脚本自检通过」这句话**无法**用 DbSync 的输出证明;本探针把**所有** warning(含 code 0)
 *      原样打出来,PRINT 自检段才看得见。
 *   ② `SqlRunner` 的结果集打印硬截断 50 行,bs_inv 有 60+ 列,列清单会被截掉。
 *   ③ sqlcmd 的 -W 与 -y/-h 互斥,取不全中文列名。
 *
 * 用法(仓库根目录):
 *   java '-Dstdout.encoding=UTF-8' -cp tools\lib\mssql-jdbc.jar tools\archive\_verify-stock-opening-2026-09-30.java [库名] [要执行的.sql]
 *   例:
 *     ... _verify-stock-opening-2026-09-30.java HSDZ_MES
 *     ... _verify-stock-opening-2026-09-30.java HSDZ_MES_TEST tools\migrate-stock-flow-opening-2026-09-30.sql
 * 口令取环境变量 YINJIA_SQL_PASS(默认 Yinjia@2026,与 DbSync 一致)。
 */
public class VerifyStockOpening {
    static String db = "HSDZ_MES";

    public static void main(String[] args) throws Exception {
        if (args.length > 0) db = args[0];
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[connected] " + c.getMetaData().getDatabaseProductName() + " @ "
                    + c.getCatalog() + " as " + c.getMetaData().getUserName());
            for (String t : new String[]{"bs_inv", "bs_wh", "kucun", "inh"}) columns(c, t);
            keyTypes(c);
            numbers(c);
            if (args.length > 1) runScript(c, Path.of(args[1]));
        }
        System.out.println("[done] " + db);
    }

    /** 完整列清单(不截断):逐列一行 + 一行逗号表,便于贴报告 */
    static void columns(Connection c, String table) throws SQLException {
        List<String> cols = new ArrayList<>();
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('" + table + "') "
                     + "ORDER BY c.column_id")) {
            while (rs.next()) cols.add(rs.getString(1));
        }
        System.out.println("== " + table + " 列(" + cols.size() + ") ==");
        for (int i = 0; i < cols.size(); i++) System.out.println("  " + (i + 1) + ". " + cols.get(i));
        System.out.println("  [CSV] " + String.join(", ", cols));
        System.out.println();
    }

    static void keyTypes(Connection c) throws SQLException {
        System.out.println("== 关键列类型 ==");
        query(c, "SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length AS len, "
                + "c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable "
                + "FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id "
                + "JOIN sys.types ty ON ty.user_type_id = c.user_type_id "
                + "WHERE t.name IN ('kucun','inh') "
                + "AND c.name IN ('wzdm','yl','price','lot_no','ckdm','asp_cancel','src','rid',"
                + "N'数量',N'单价',N'金额',N'物料编码',N'物料名称',N'规格型号',N'计量单位',N'仓库编码',"
                + "N'仓库名称',N'批号',N'单据编号',N'单据类型',N'单据日期',N'往来单位',N'经手人',"
                + "N'asp_user1',N'asp_time1') ORDER BY t.name, c.column_id");
        System.out.println();
    }

    /** 任务 2 的核心验收数字 */
    static void numbers(Connection c) throws SQLException {
        System.out.println("== 核心数字 ==");
        query(c, "SELECT COUNT(*) AS kucun_行数, "
                + "CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) AS kucun_余量合计 "
                + "FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'");
        query(c, "SELECT COUNT(*) AS inh_期初行数, "
                + "CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) AS inh_期初流水合计, "
                + "CAST(ISNULL(SUM(金额),0) AS decimal(18,4)) AS inh_期初金额合计 "
                + "FROM inh WHERE src = 0 AND ISNULL(asp_cancel,'N') <> 'Y'");
        query(c, "SELECT "
                + "CAST((SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') AS decimal(18,4)) AS kucun_余量合计, "
                + "CAST((SELECT ISNULL(SUM(数量),0) FROM inh WHERE src=0 AND ISNULL(asp_cancel,'N') <> 'Y') AS decimal(18,4)) AS inh_期初合计, "
                + "CAST(ABS((SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') "
                + "        - (SELECT ISNULL(SUM(数量),0) FROM inh WHERE src=0 AND ISNULL(asp_cancel,'N') <> 'Y')) AS decimal(18,4)) AS 绝对差, "
                + "CASE WHEN ABS((SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') "
                + "             - (SELECT ISNULL(SUM(数量),0) FROM inh WHERE src=0 AND ISNULL(asp_cancel,'N') <> 'Y')) < 0.01 "
                + "     THEN N'PASS' ELSE N'FAIL' END AS 判定");
        query(c, "SELECT src, COUNT(*) AS 行数, CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) AS 数量合计 "
                + "FROM inh GROUP BY src ORDER BY src");
        System.out.println();
    }

    /** 执行 .sql:按 GO 切批,**回显所有** SQLWarning(含 code 0 的 PRINT)与结果集 */
    static void runScript(Connection c, Path file) throws Exception {
        System.out.println("== 执行脚本 " + file.getFileName() + " ==");
        String raw = Files.readString(file, StandardCharsets.UTF_8);
        if (!raw.isEmpty() && raw.codePointAt(0) == 0xFEFF) raw = raw.substring(1);
        int n = 0;
        try (Statement st = c.createStatement()) {
            st.execute("SET NOEXEC OFF");
            for (String batch : splitGo(raw)) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                n++;
                boolean hasRs = st.execute(b);
                // PRINT 走 SQLWarning(errorCode 0);这里**不按码过滤**,全打
                for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning()) {
                    System.out.println("  [msg code=" + w.getErrorCode() + "] " + w.getMessage().trim());
                }
                st.clearWarnings();
                if (hasRs) {
                    ResultSet rs = st.getResultSet();
                    if (rs != null) {
                        try (rs) {
                            ResultSetMetaData md = rs.getMetaData();
                            int cols = md.getColumnCount();
                            while (rs.next()) {
                                StringBuilder sb = new StringBuilder("  | ");
                                for (int i = 1; i <= cols; i++) sb.append(rs.getString(i)).append(" | ");
                                System.out.println(sb);
                            }
                        }
                    }
                } else {
                    int u = st.getUpdateCount();
                    if (u >= 0) System.out.println("  (" + u + " rows affected)");
                }
            }
        }
        System.out.println("  [script done] " + n + " batches");
        System.out.println();
    }

    static void query(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int cols = md.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= cols; i++) h.append(md.getColumnLabel(i)).append(i < cols ? " | " : "");
            System.out.println(h);
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("  ");
                for (int i = 1; i <= cols; i++) sb.append(rs.getString(i)).append(i < cols ? " | " : "");
                System.out.println(sb);
            }
        }
    }

    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().toUpperCase(Locale.ROOT).matches("GO(\\s+\\d+)?")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }
}
