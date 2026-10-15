import java.sql.*;
import java.util.*;

/**
 * Probe3 — 逐条语句试跑改版后的成本重算(整段在事务里,末尾 ROLLBACK,不留痕)。
 * 目的:① 量各步骤耗时 ② 查清 #rec 里到底哪一列出了 NULL。
 * 用法:java -cp lib\mssql-jdbc.jar Probe3.java [库名]
 */
public class Probe3 {
    static String DB = "HSDZ_MES";

    public static void main(String[] a) throws Exception {
        if (a.length > 0) DB = a[0];
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + DB
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=15";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            long t0 = System.currentTimeMillis();
            try (Statement st = c.createStatement()) {
                st.execute("IF OBJECT_ID('tempdb..#s') IS NOT NULL DROP TABLE #s");
                step(st, "① 落 #s(读 v_stock_movement + 行号)", t0 = now(),
                        "SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,"
                      + " ISNULL(收入数量, 0) AS 收入数量, ISNULL(发出数量, 0) AS 发出数量, ISNULL(收入金额, 0) AS 收入金额,"
                      + " CASE WHEN 收入金额 IS NULL THEN 1 ELSE 0 END AS 缺金额,"
                      + " ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn"
                      + " INTO #s FROM dbo.v_stock_movement");
                System.out.println("      #s 行数 = " + scalar(st, "SELECT COUNT(*) FROM #s")
                        + " · 金额缺失行 = " + scalar(st, "SELECT COUNT(*) FROM #s WHERE 缺金额 = 1"));

                step(st, "② 建聚簇索引 (仓库键,存货编码,rn)", t0 = now(),
                        "CREATE UNIQUE CLUSTERED INDEX IX_s ON #s (仓库键, 存货编码, rn)");

                st.execute("IF OBJECT_ID('tempdb..#rec') IS NOT NULL DROP TABLE #rec");
                step(st, "③ 递归主体 → #rec", t0 = now(),
                        "WITH rec AS ("
                      + " SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,"
                      + " CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,"
                      + " CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额,"
                      + " CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 发出成本金额,"
                      + " CAST(收入数量 AS decimal(38,10)) AS 收入数量, CAST(发出数量 AS decimal(38,10)) AS 发出数量, CAST(收入金额 AS decimal(38,10)) AS 收入金额"
                      + " FROM #s WHERE rn = 1"
                      + " UNION ALL"
                      + " SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,"
                      + " CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),"
                      + " CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),"
                      + " CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),"
                      + " CAST(s.收入数量 AS decimal(38,10)), CAST(s.发出数量 AS decimal(38,10)), CAST(s.收入金额 AS decimal(38,10))"
                      + " FROM rec JOIN #s s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1"
                      + ") SELECT * INTO #rec FROM rec OPTION (MAXRECURSION 0)");
                System.out.println("      #rec 行数 = " + scalar(st, "SELECT COUNT(*) FROM #rec"));
                try (ResultSet rs = st.executeQuery(
                        "SELECT SUM(CASE WHEN src IS NULL THEN 1 ELSE 0 END) AS src_n,"
                      + " SUM(CASE WHEN rid IS NULL THEN 1 ELSE 0 END) AS rid_n,"
                      + " SUM(CASE WHEN 仓库键 IS NULL THEN 1 ELSE 0 END) AS wk_n,"
                      + " SUM(CASE WHEN 存货编码 IS NULL THEN 1 ELSE 0 END) AS ic_n,"
                      + " SUM(CASE WHEN 批号 IS NULL THEN 1 ELSE 0 END) AS lot_n,"
                      + " SUM(CASE WHEN 单据日期 IS NULL THEN 1 ELSE 0 END) AS dt_n,"
                      + " SUM(CASE WHEN 结存数量 IS NULL THEN 1 ELSE 0 END) AS qty_n"
                      + " FROM #rec")) {
                    if (rs.next()) System.out.println("      #rec 空值: src=" + rs.getInt("src_n") + " rid=" + rs.getInt("rid_n")
                            + " 仓库键=" + rs.getInt("wk_n") + " 存货编码=" + rs.getInt("ic_n") + " 批号=" + rs.getInt("lot_n")
                            + " 单据日期=" + rs.getInt("dt_n") + " 结存数量=" + rs.getInt("qty_n"));
                }

                step(st, "④a DELETE inv_cost_ledger", t0 = now(), "DELETE FROM dbo.inv_cost_ledger");
                // 逐列查 #rec 的空值(动态拼,不漏列)
                List<String> cols = new ArrayList<>();
                try (ResultSet rs = st.executeQuery("SELECT name FROM tempdb.sys.columns WHERE object_id = OBJECT_ID('tempdb..#rec') ORDER BY column_id")) {
                    while (rs.next()) cols.add(rs.getString(1));
                }
                StringBuilder q = new StringBuilder("SELECT COUNT(*) AS n");
                for (String col : cols) q.append(", SUM(CASE WHEN [").append(col).append("] IS NULL THEN 1 ELSE 0 END) AS [").append(col).append("_null]");
                q.append(" FROM #rec");
                try (ResultSet rs = st.executeQuery(q.toString())) {
                    if (rs.next()) {
                        StringBuilder sb = new StringBuilder("      #rec 各列空值: ");
                        for (String col : cols) sb.append(col).append("=").append(rs.getInt(col + "_null")).append(" ");
                        System.out.println(sb);
                    }
                }
                try {
                    step(st, "④b INSERT inv_cost_ledger", t0 = now(),
                            "INSERT INTO dbo.inv_cost_ledger"
                          + " (src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,"
                          + "  结存数量, 移动加权单价, 结存金额, 发出成本金额, 重算时间)"
                          + " SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,"
                          + " CAST(收入数量 AS decimal(18,4)), CAST(发出数量 AS decimal(18,4)), CAST(收入金额 AS decimal(18,4)),"
                          + " CAST(结存数量 AS decimal(18,4)),"
                          + " CAST(CASE WHEN 结存数量 <> 0 THEN 结存金额 / 结存数量 ELSE 0 END AS decimal(18,6)),"
                          + " CAST(结存金额 AS decimal(18,4)), CAST(发出成本金额 AS decimal(18,4)), SYSDATETIME()"
                          + " FROM #rec");
                } catch (SQLException e) {
                    StringBuilder sb = new StringBuilder();
                    for (char ch : String.valueOf(e.getMessage()).toCharArray()) sb.append(String.format("\\u%04x", (int) ch));
                    System.out.println("      [INSERT 失败] " + sb);
                    throw e;
                }
                System.out.println("      inv_cost_ledger 行数 = " + scalar(st, "SELECT COUNT(*) FROM dbo.inv_cost_ledger"));
                System.out.println("      SUM(结存金额) = " + scalarD(st, "SELECT SUM(结存金额) FROM dbo.inv_cost_ledger")
                        + " / SUM(发出成本金额) = " + scalarD(st, "SELECT SUM(发出成本金额) FROM dbo.inv_cost_ledger"));
            } finally {
                c.rollback();
                try (Statement st2 = c.createStatement()) {
                    st2.execute("IF OBJECT_ID('tempdb..#rec') IS NOT NULL DROP TABLE #rec");
                    st2.execute("IF OBJECT_ID('tempdb..#s') IS NOT NULL DROP TABLE #s");
                }
                System.out.println("[ROLLBACK] 事务已回滚,数据未改");
            }
        }
    }

    static long now() { return System.currentTimeMillis(); }

    static void step(Statement st, String label, long t0, String sql) throws SQLException {
        st.execute(sql);
        System.out.printf("  %-38s %7d ms%n", label, System.currentTimeMillis() - t0);
    }

    static int scalar(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? rs.getInt(1) : -1; }
    }

    static String scalarD(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? String.valueOf(rs.getBigDecimal(1)) : "null"; }
    }
}
