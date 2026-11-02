/*
 * Probe.java — 2026-10-29「调拨只能调拨到当前工序的产线」取证探针(只读,不改任何数据)
 *
 * 目的:在动前端/接口之前,先用**正式库**确认三件事:
 *   ① 产线档案的车间分布(成型/切炭/组装…),确定"当前工序 → 候选线"到底有没有可选项;
 *   ② `plang` 已排产行的「当前工序」(canonical SQL:台账最后一道已落实 → 回落 p.当前工序)
 *      与所在产线车间的**匹配情况** —— 有多少历史行本来就跨车间(这些行一旦调拨会被新守卫拦住);
 *   ③ `wo_process_line` 的台账形态(工单行id 是否为空、状态取值),确认 currentProcess 的定位条件能命中。
 *
 * 跑法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\Probe.java
 *   测试账套:YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\Probe.java
 */
import java.sql.*;
import java.util.*;

public class Probe {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB
            + ";encrypt=false;loginTimeout=10";
    static final String USER = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("== DB " + DB + " ==");

            System.out.println("\n① 产线档案(启用):车间 / 线数");
            q(c, "SELECT ISNULL(生产车间,N'(空)') AS 车间, COUNT(*) AS 线数,"
                    + " SUM(CASE WHEN ISNULL(停用,0)=1 THEN 1 ELSE 0 END) AS 停用线数"
                    + " FROM dbo.bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " GROUP BY ISNULL(生产车间,N'(空)') ORDER BY 车间");

            System.out.println("\n② 已排产行的当前工序 vs 所在线车间(前 25 行)");
            q(c, "SELECT TOP 25 p.pl_no AS 工单号, p.pl_xc AS 行号, p.scx AS 当前线,"
                    + " ISNULL((SELECT TOP 1 l.生产车间 FROM dbo.bs_prod_line l WHERE l.生产线=p.scx),N'') AS 线车间,"
                    + " ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                    + "   WHERE w.工单号=p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                    + "     AND (w.工单行id=p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                    + "   ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序],N'')) AS 当前工序"
                    + " FROM dbo.plang p WHERE ISNULL(p.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y'"
                    + " ORDER BY p.id DESC");

            System.out.println("\n③ 汇总:已排产行的 当前工序/线车间 匹配情况");
            q(c, "WITH t AS (SELECT p.id, ISNULL(p.scx,N'') AS scx,"
                    + "  ISNULL((SELECT TOP 1 l.生产车间 FROM dbo.bs_prod_line l WHERE l.生产线=p.scx),N'') AS lineShop,"
                    + "  ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
                    + "    WHERE w.工单号=p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
                    + "      AND (w.工单行id=p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
                    + "    ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序],N'')) AS op"
                    + "  FROM dbo.plang p WHERE ISNULL(p.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y')"
                    + " SELECT COUNT(*) AS 已排产行数,"
                    + "  SUM(CASE WHEN op=N'' THEN 1 ELSE 0 END) AS 当前工序为空,"
                    + "  SUM(CASE WHEN op<>N'' AND lineShop<>N'' AND op=lineShop THEN 1 ELSE 0 END) AS 工序与线车间一致,"
                    + "  SUM(CASE WHEN op<>N'' AND lineShop<>N'' AND op<>lineShop"
                    + "    AND (CASE WHEN op=N'装箱' THEN N'组装' ELSE op END)<>lineShop THEN 1 ELSE 0 END) AS 工序与线车间不一致,"
                    + "  SUM(CASE WHEN lineShop=N'' THEN 1 ELSE 0 END) AS 线未归类车间 FROM t");

            System.out.println("\n④ 工序台账形态(wo_process_line)");
            q(c, "SELECT ISNULL(状态,N'(空)') AS 状态, COUNT(*) AS 行数,"
                    + " SUM(CASE WHEN 工单行id IS NULL THEN 1 ELSE 0 END) AS 工单行id为空"
                    + " FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " GROUP BY ISNULL(状态,N'(空)') ORDER BY 状态");

            System.out.println("\n⑤ 已落实台账的工序分布(决定 currentProcess 命中的工序名)");
            q(c, "SELECT w.工序, COUNT(*) AS 行数, COUNT(DISTINCT w.工单号) AS 工单数"
                    + " FROM dbo.wo_process_line w WHERE ISNULL(w.asp_cancel,'N')<>'Y'"
                    + " AND ISNULL(w.状态,N'')=N'已落实' GROUP BY w.工序 ORDER BY 行数 DESC");
        }
    }

    static void q(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= n; i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            System.out.println("  " + "-".repeat(Math.max(head.length(), 24)));
            while (r.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= n; i++) row.append(i > 1 ? " | " : "").append(r.getString(i) == null ? "" : r.getString(i));
                System.out.println("  " + row);
            }
        }
    }
}
