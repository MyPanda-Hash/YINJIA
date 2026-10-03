import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 任务 4 验证探针:v_stock_movement 改为读流水表(inh/outh)的前后核对工具。
 *
 * 为什么需要它(而不是 DbSync / sqlcmd):
 *   ① DbSync 只回显**白名单内且非 0** 错误码的 warning ⇒ 脚本里的 `PRINT`(码 0)被静默吞掉,
 *      "脚本自检通过"这句话**无法**用 DbSync 的输出证明;本探针把**所有** warning(含码 0)
 *      原样打出来。(见 tools/DbSync.java:220-228)
 *   ② `SqlRunner` 的结果集打印硬截断 50 行;本探针不截断。
 *   ③ sqlcmd 的 -W 与 -y/-h 互斥,取不全中文列名。
 *   ④ 最关键:**模式 dry** 把交付脚本跑在**事务内然后 ROLLBACK** ——
 *      能在真改库之前证明"改完之后 3 个下游视图查得动 + 成本重算灌得出",且不留任何对象。
 *      成本重算的 SQL 是**从 InvCostService.java 源码里抽出来的**(不手抄,手抄就是第二份真相)。
 *
 * 用法(仓库根目录):
 *   java '-Dstdout.encoding=UTF-8' -cp tools\lib\mssql-jdbc.jar tools\archive\_verify-stock-movement-2026-09-30.java <库> [模式] [交付脚本路径]
 *     <库>       HSDZ_MES | HSDZ_MES_TEST
 *     模式       dry  = 事务内执行交付脚本 + 全量核对 + ROLLBACK
 *                check(默认) = 只读核对当前库状态(改后复验用)
 *     脚本路径   默认 tools\migrate-stock-movement-from-flow-2026-09-30.sql
 *
 * 口令取环境变量 YINJIA_SQL_PASS(默认 Yinjia@2026,与 DbSync 一致)。
 */
public class VerifyStockMovement {

    /** v_stock_movement 的列契约(23 列,名字与顺序都是硬约束)。 */
    static final String[] CONTRACT = {
        "src", "rid", "单据日期", "单据类型", "单据编号", "业务类型", "仓库键", "仓库编码", "仓库",
        "存货编码", "存货", "规格型号", "计量单位", "批号", "收入数量", "发出数量", "收入金额",
        "发出单据金额", "含税金额", "税额", "往来单位", "往来单位编码", "经手人"};

    static String db = "HSDZ_MES";

    public static void main(String[] args) throws Exception {
        db = args.length > 0 ? args[0] : "HSDZ_MES";
        String mode = args.length > 1 ? args[1] : "check";
        Path script = Path.of(args.length > 2 ? args[2] : "tools/migrate-stock-movement-from-flow-2026-09-30.sql");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== [DB] " + db + " @ " + c.getCatalog() + " 模式=" + mode + " ==");
            if ("dry".equalsIgnoreCase(mode)) {
                c.setAutoCommit(false);
                try {
                    System.out.println("\n---- 阶段 1:事务内执行交付脚本 " + script.getFileName() + " ----");
                    for (String b : splitGo(read(script))) {
                        String s = b.trim();
                        if (s.isEmpty()) continue;
                        try (Statement st = c.createStatement()) {
                            st.execute(s);
                            for (SQLWarning w = st.getWarnings(); w != null; w = w.getNextWarning())
                                System.out.println("  [msg code=" + w.getErrorCode() + "] " + w.getMessage().trim());
                            st.clearWarnings();
                        }
                    }
                    System.out.println("\n---- 阶段 2:改后核对 - 列契约逐列对比 ----");
                    contract(c);
                    System.out.println("\n---- 阶段 3:三个下游视图 ----");
                    downstream(c);
                    System.out.println("\n---- 阶段 4:成本重算(InvCostService 源码原文) ----");
                    costRecalc(c);
                    System.out.println("\n---- 阶段 5:历史单据代价 ----");
                    auditGap(c);
                    System.out.println("\n---- 阶段 6:性能计时 ----");
                    timing(c);
                } catch (Exception e) {
                    System.out.println("[ABORT] " + e.getClass().getSimpleName() + ": " + e.getMessage());
                } finally {
                    c.rollback();
                    System.out.println("\n[ROLLBACK] 事务已回滚 —— 交付脚本未在库中留下任何改动");
                }
            } else {
                System.out.println("\n---- 列契约逐列对比 ----");
                contract(c);
                System.out.println("\n---- 三个下游视图 ----");
                downstream(c);
                System.out.println("\n---- 成本物化表 ----");
                query(c, "SELECT COUNT(*) AS 成本行数, CAST(ISNULL(SUM(收入金额),0) AS decimal(18,4)) AS 收入金额合计, "
                        + "CAST(ISNULL(SUM(发出成本金额),0) AS decimal(18,4)) AS 发出成本合计, "
                        + "CAST(ISNULL(SUM(结存数量),0) AS decimal(18,4)) AS 结存数量合计, "
                        + "CAST(ISNULL(SUM(结存金额),0) AS decimal(18,4)) AS 结存金额合计 FROM inv_cost_ledger");
                query(c, "SELECT COUNT(*) AS 无成本行的流水 FROM v_stock_movement m "
                        + "LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid WHERE c.src IS NULL");
                System.out.println("\n---- 历史单据代价 ----");
                auditGap(c);
                System.out.println("\n---- 性能计时 ----");
                timing(c);
            }
            System.out.println("\n[done] " + db);
        }
    }

    /** 改前契约:交给调用方用 -Dbefore=&lt;文件&gt; 提供 sys.columns 基线,便于逐列机器比对。 */
    static void contract(Connection c) throws Exception {
        List<String> now = cols(c);
        List<String> names = new ArrayList<>();
        for (String r : now) names.add(r.split(" \\| ")[0]);
        boolean nameOk = names.equals(Arrays.asList(CONTRACT));
        System.out.println("  列数 = " + now.size() + "(契约 23);列名与顺序一致: " + (nameOk ? "PASS" : "FAIL"));
        if (!nameOk) {
            System.out.println("  期望: " + String.join(",", CONTRACT));
            System.out.println("  实际: " + String.join(",", names));
        }
        String beforePath = System.getProperty("before");
        if (beforePath != null && Files.exists(Path.of(beforePath))) {
            List<String> before = Files.readAllLines(Path.of(beforePath), StandardCharsets.UTF_8);
            System.out.println("  ---- 与基线 " + beforePath + " 逐列对比 ----");
            System.out.println("  " + pad("列", 18) + pad("改前", 34) + "改后");
            int diff = 0;
            for (int i = 0; i < Math.max(before.size(), now.size()); i++) {
                String b = i < before.size() ? before.get(i) : "(缺)";
                String n = i < now.size() ? now.get(i) : "(缺)";
                boolean same = b.equals(n);
                if (!same) diff++;
                System.out.println("  " + pad(i < now.size() ? names.get(i) : "-", 18) + pad(b, 34) + n + (same ? "" : "   <<< 差异"));
            }
            System.out.println("  差异列数 = " + diff);
        } else {
            for (int i = 0; i < now.size(); i++) System.out.println("  " + (i + 1) + ". " + now.get(i));
        }
    }

    static void downstream(Connection c) {
        query(c, "SELECT TOP 5 * FROM v_stock_balance");
        query(c, "SELECT TOP 5 * FROM v_stock_ledger");
        query(c, "SELECT TOP 5 * FROM v_stock_summary");
        // 勾稽:报表现存量合计 vs kucun 余量合计
        query(c, "SELECT CAST((SELECT ISNULL(SUM(m.收入数量),0) - ISNULL(SUM(m.发出数量),0) FROM v_stock_movement m) AS decimal(18,4)) AS 流水净数量, "
                + "CAST((SELECT ISNULL(SUM(现存量),0) FROM v_stock_balance) AS decimal(18,4)) AS balance_现存量合计, "
                + "CAST((SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS decimal(18,4)) AS kucun_余量合计, "
                + "CAST(ABS((SELECT ISNULL(SUM(现存量),0) FROM v_stock_balance) "
                + "       - (SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y')) AS decimal(18,4)) AS 绝对差");
        query(c, "SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数, "
                + "(SELECT COUNT(*) FROM v_stock_ledger) AS 台账行数, "
                + "(SELECT COUNT(*) FROM v_stock_summary) AS 汇总行数, "
                + "(SELECT COUNT(*) FROM v_stock_balance) AS 状况行数");
    }

    /** 成本重算:RECURSE 字符串**从 InvCostService.java 源码抽取**(不手抄)。 */
    static void costRecalc(Connection c) throws Exception {
        Path src = Path.of("backend/src/main/java/com/yinjia/mes/service/InvCostService.java");
        String recurse = extractRecurse(src);
        System.out.println("  已从 " + src + " 抽取 RECURSE(" + recurse.length() + " 字符,"
                + (recurse.contains("%WHERE%") ? "含占位符" : "!!无占位符,抽取可疑!!") + ")");
        try (Statement st = c.createStatement()) {
            st.execute("DELETE FROM dbo.inv_cost_ledger");
        }
        try (Statement st = c.createStatement()) {
            st.executeUpdate(recurse.replace("%WHERE%", ""));
            // 多语句批(WITH…INSERT)的 executeUpdate 返回值不可信(实测 -1),行数以随后的查询为准
            System.out.println("  [OK] 成本重算已执行(实际行数见下一行查询)");
        } catch (SQLException e) {
            System.out.println("  [FAIL] error " + e.getErrorCode() + ": " + e.getMessage());
        }
        query(c, "SELECT COUNT(*) AS 成本行数, CAST(ISNULL(SUM(收入数量),0) AS decimal(18,4)) AS 收入数量合计, "
                + "CAST(ISNULL(SUM(收入金额),0) AS decimal(18,4)) AS 收入金额合计, "
                + "CAST(ISNULL(SUM(结存数量),0) AS decimal(18,4)) AS 结存数量合计, "
                + "CAST(ISNULL(SUM(结存金额),0) AS decimal(18,4)) AS 结存金额合计 FROM inv_cost_ledger");
        query(c, "SELECT COUNT(*) AS 无成本行的流水 FROM v_stock_movement m "
                + "LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid WHERE c.src IS NULL");
        query(c, "SELECT TOP 3 src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 收入金额, 结存数量, 移动加权单价, 结存金额 FROM inv_cost_ledger ORDER BY 仓库键, 存货编码, 单据日期, src, rid");
        // 成本口径校验:成本表的收入金额合计应等于视图的收入金额合计
        query(c, "SELECT CAST((SELECT ISNULL(SUM(收入金额),0) FROM v_stock_movement) AS decimal(18,4)) AS 视图_收入金额合计, "
                + "CAST((SELECT ISNULL(SUM(收入金额),0) FROM inv_cost_ledger) AS decimal(18,4)) AS 成本表_收入金额合计");
    }

    /** 从 InvCostService.java 抽出 RECURSE 常量(拼接所有双引号字面量)。 */
    static String extractRecurse(Path src) throws Exception {
        String text = Files.readString(src, StandardCharsets.UTF_8);
        int i = text.indexOf("String RECURSE");
        if (i < 0) throw new IllegalStateException("未找到 RECURSE 常量");
        i = text.indexOf('=', i);
        // 终止符是最后一个字面量的收尾引号 `";`。**不要用 indexOf(";\n")**:
        // 仓库是 Windows 检出(CRLF),`;\r\n` 匹配不上 `;\n`,会让抽取一直吃到文件尾
        // (实测抽成 1996 字符的垃圾 —— 末尾混进 DELETE / reconcile 的 SQL,执行报 error 102)。
        int end = text.indexOf("\";", i);
        if (end < 0) throw new IllegalStateException("未找到 RECURSE 的收尾 \";");
        String decl = text.substring(i + 1, end);
        StringBuilder sb = new StringBuilder();
        boolean inStr = false;
        for (int k = 0; k < decl.length(); k++) {
            char ch = decl.charAt(k);
            if (ch == '"' && (k == 0 || decl.charAt(k - 1) != '\\')) { inStr = !inStr; continue; }
            if (inStr) sb.append(ch);
        }
        return sb.toString();
    }

    /** 八类单据「已审核但流水表无对应行」的反查(口径照 migrate-inv-report-fields.sql 旧视图 WHERE)。 */
    static void auditGap(Connection c) {
        String[] in = {
            "SELECT 1 AS src, l.id AS rid FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='PURCHASE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 2, l.id FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='FINISH_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 3, l.id FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OTHER_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 4, l.id FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OUTSOURCE_IN' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 5, l.id FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='SALE_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 6, l.id FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='MATERIAL_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 7, l.id FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OTHER_OUT' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))",
            "SELECT 8, l.id FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' AND (h.单据状态=N'已审核' OR EXISTS(SELECT 1 FROM yj_doc_status st WHERE st.panel_code='OUTSOURCE_ISSUE' AND st.doc_no=h.单据编号 AND st.shr IS NOT NULL))"
        };
        StringBuilder sb = new StringBuilder("WITH au AS (\n");
        for (int i = 0; i < in.length; i++) {
            if (i > 0) sb.append("  UNION ALL\n");
            sb.append("  ").append(in[i]).append('\n');
        }
        sb.append(")\nSELECT src, COUNT(*) AS 旧口径已审核行数, ")
          .append("SUM(缺流水) AS 无流水行数 FROM (SELECT au.src, CASE WHEN au.src<=4 THEN ")
          .append("(CASE WHEN EXISTS(SELECT 1 FROM inh x WHERE x.src=au.src AND x.rid=au.rid) THEN 0 ELSE 1 END) ")
          .append("ELSE (CASE WHEN EXISTS(SELECT 1 FROM outh x WHERE x.src=au.src AND x.rid=au.rid) THEN 0 ELSE 1 END) END AS 缺流水 FROM au) t ")
          .append("GROUP BY src ORDER BY src");
        query(c, sb.toString());
        // 没有行不代表"查得对":补一条结构性证据 —— 旧视图的 8 个分支都是 bl_ JOIN bd_,头表全空则旧视图必然查不出行
        query(c, "SELECT (SELECT COUNT(*) FROM bd_purchase_in)+(SELECT COUNT(*) FROM bd_finish_in)"
                + "+(SELECT COUNT(*) FROM bd_other_in)+(SELECT COUNT(*) FROM bd_outsource_in)"
                + "+(SELECT COUNT(*) FROM bd_sale_out)+(SELECT COUNT(*) FROM bd_material_out)"
                + "+(SELECT COUNT(*) FROM bd_other_out)+(SELECT COUNT(*) FROM bd_outsource_issue) AS 八张头表行数合计, "
                + "(SELECT COUNT(*) FROM bl_purchase_in)+(SELECT COUNT(*) FROM bl_finish_in)"
                + "+(SELECT COUNT(*) FROM bl_other_in)+(SELECT COUNT(*) FROM bl_outsource_in)"
                + "+(SELECT COUNT(*) FROM bl_sale_out)+(SELECT COUNT(*) FROM bl_material_out)"
                + "+(SELECT COUNT(*) FROM bl_other_out)+(SELECT COUNT(*) FROM bl_outsource_issue) AS 八张行表行数合计, "
                + "(SELECT COUNT(*) FROM yj_doc_status WHERE panel_code IN ('PURCHASE_IN','FINISH_IN','OTHER_IN','OUTSOURCE_IN','SALE_OUT','MATERIAL_OUT','OTHER_OUT','OUTSOURCE_ISSUE')) AS 库存类单据状态行数");
    }

    /**
     * 查询耗时(冷/热各量)。
     * ⚠ 计时必须把 `executeQuery` **包在里面** —— 语句是在 executeQuery 里执行的,只计时它之后的
     *   取值等于只量了个取数(实测全是 0 ms),那种数字不能用来对比。
     */
    static void timing(Connection c) {
        for (String v : new String[]{"v_stock_movement", "v_stock_balance", "v_stock_ledger", "v_stock_summary"}) {
            for (int i = 0; i < 3; i++) {
                long t0 = System.nanoTime();
                int n = -1;
                String err = null;
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + v)) {
                    rs.next();
                    n = rs.getInt(1);
                } catch (SQLException e) {
                    err = "ERR " + e.getErrorCode() + " " + e.getMessage();
                }
                long ms = (System.nanoTime() - t0) / 1000000L;
                System.out.println("  " + pad(v, 20) + " #" + (i + 1) + " -> " + pad(String.valueOf(n), 8)
                        + ms + " ms" + (err == null ? "" : "  " + err));
            }
        }
        // 与数据量无关的收益证据:视图依赖的**对象个数**(8 路 UNION 会牵出 16 张单据表)
        query(c, "SELECT COUNT(*) AS 视图依赖对象数 FROM sys.sql_expression_dependencies d "
                + "WHERE d.referencing_id = OBJECT_ID('dbo.v_stock_movement')");
        query(c, "SELECT DISTINCT d.referenced_entity_name AS 依赖对象 FROM sys.sql_expression_dependencies d "
                + "WHERE d.referencing_id = OBJECT_ID('dbo.v_stock_movement') ORDER BY 1");
    }

    static List<String> cols(Connection c) throws SQLException {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT c.name, ty.name, c.max_length, c.precision, c.scale, c.is_nullable FROM sys.columns c "
                + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID(?) ORDER BY c.column_id")) {
            ps.setString(1, "dbo.v_stock_movement");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String t = rs.getString(2);
                    String len = t.contains("char") ? String.valueOf(rs.getInt(3) / 2) : String.valueOf(rs.getInt(4));
                    if (t.startsWith("decimal")) len += "," + rs.getInt(5);
                    out.add(rs.getString(1) + " | " + t + "(" + len + ") | " + (rs.getBoolean(6) ? "NULL" : "NOT NULL"));
                }
            }
        }
        return out;
    }

    static String read(Path p) throws Exception {
        String s = Files.readString(p, StandardCharsets.UTF_8);
        return (!s.isEmpty() && s.codePointAt(0) == 0xFEFF) ? s.substring(1) : s;
    }

    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }

    static String pad(String s, int w) {
        StringBuilder b = new StringBuilder(s == null ? "" : s);
        while (b.length() < w) b.append(' ');
        return b.toString();
    }

    static void query(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) h.append(md.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    String v = rs.getString(i);
                    sb.append(v == null ? "null" : v).append(i < n ? " | " : "");
                }
                System.out.println(sb);
                rows++;
            }
            if (rows == 0) System.out.println("  (0 rows)");
        } catch (SQLException e) {
            System.out.println("  [ERR " + e.getErrorCode() + "] " + e.getMessage());
        }
    }
}
