import java.sql.*;

/**
 * Probe4 — 重算结果的"体检"(只读,末尾 ROLLBACK):
 *   ① 逐行比对「新路径(临时表)」与「旧路径(CTE 现场查视图 + ISNULL 补丁)」是否**逐行一致**
 *      —— 证明改写只提速、不改口径;
 *   ② 结果本身是否合理:分区末行结存数量为负的分区、异常单价、库存价值 vs Σ收入−Σ发出成本。
 * 用法:java -cp lib\mssql-jdbc.jar Probe4.java [库名] [--skip-old]
 */
public class Probe4 {
    static String DB = "HSDZ_MES";
    static boolean skipOld = false;

    public static void main(String[] a) throws Exception {
        for (String s : a) { if ("--skip-old".equals(s)) skipOld = true; else DB = s; }
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + DB
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=15";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                drop(st);
                st.execute(STEP_S);
                st.execute("CREATE UNIQUE CLUSTERED INDEX IX_s ON #s (仓库键, 存货编码, rn)");
                st.execute(REC_NEW_INTO);
                System.out.println("新路径 #new 行数 = " + scalar(st, "SELECT COUNT(*) FROM #new"));

                if (!skipOld) {
                    long t = System.currentTimeMillis();
                    st.execute(REC_OLD_INTO);
                    System.out.printf("旧路径(CTE 现场查视图)算完 #old 用了 %d ms,行数 = %s%n",
                            System.currentTimeMillis() - t, scalar(st, "SELECT COUNT(*) FROM #old"));
                    // 逐行比对(键 src+rid)
                    try (ResultSet rs = st.executeQuery(
                            "SELECT COUNT(*) AS 差异行 FROM ("
                          + " SELECT src, rid, 结存数量, 结存金额, 发出成本金额 FROM #new"
                          + " EXCEPT"
                          + " SELECT src, rid, 结存数量, 结存金额, 发出成本金额 FROM #old) x")) {
                        if (rs.next()) System.out.println("逐行比对(#new EXCEPT #old)= " + rs.getInt(1) + " 行差异");
                    }
                    try (ResultSet rs = st.executeQuery(
                            "SELECT COUNT(*) AS 差异行 FROM ("
                          + " SELECT src, rid, 结存数量, 结存金额, 发出成本金额 FROM #old"
                          + " EXCEPT"
                          + " SELECT src, rid, 结存数量, 结存金额, 发出成本金额 FROM #new) x")) {
                        if (rs.next()) System.out.println("逐行比对(#old EXCEPT #new)= " + rs.getInt(1) + " 行差异");
                    }
                }

                // 体检
                System.out.println("分区数 = " + scalar(st, "SELECT COUNT(DISTINCT 仓库键 + N'|' + 存货编码) FROM #new"));
                try (ResultSet rs = st.executeQuery(
                        "WITH last AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY rn DESC) AS rk FROM #new)"
                      + " SELECT (SELECT COUNT(*) FROM last WHERE rk = 1) AS 分区数,"
                      + " (SELECT COUNT(*) FROM last WHERE rk = 1 AND 结存数量 < 0) AS 末行负数分区,"
                      + " (SELECT COUNT(*) FROM last WHERE rk = 1 AND 结存金额 < 0) AS 末行负金额分区,"
                      + " (SELECT CAST(SUM(结存金额) AS decimal(18,2)) FROM last WHERE rk = 1) AS 库存价值_末行合计,"
                      + " (SELECT CAST(SUM(收入金额) - SUM(发出成本金额) AS decimal(18,2)) FROM #new) AS Σ收入_减_Σ发出成本,"
                      + " (SELECT CAST(SUM(发出成本金额) AS decimal(18,2)) FROM #new) AS Σ发出成本,"
                      + " (SELECT CAST(SUM(收入金额) AS decimal(18,2)) FROM #new) AS Σ收入金额")) {
                    if (rs.next()) {
                        System.out.println("  分区数=" + rs.getInt("分区数") + " 末行结存<0 的分区=" + rs.getInt("末行负数分区")
                                + " 末行金额<0 的分区=" + rs.getInt("末行负金额分区"));
                        System.out.println("  库存价值(各分区末行 结存金额 合计) = " + rs.getBigDecimal("库存价值_末行合计"));
                        System.out.println("  Σ收入金额 = " + rs.getBigDecimal("Σ收入金额") + " / Σ发出成本 = " + rs.getBigDecimal("Σ发出成本")
                                + " / 差额 = " + rs.getBigDecimal("Σ收入_减_Σ发出成本"));
                    }
                }
                try (ResultSet rs = st.executeQuery(
                        "SELECT TOP 5 仓库键, 存货编码, rn, 收入数量, 发出数量, 结存数量, CAST(结存金额 AS decimal(18,2)) AS 结存金额,"
                      + " CAST(发出成本金额 AS decimal(18,2)) AS 发出成本金额 FROM #new WHERE ABS(发出成本金额) > 100000 ORDER BY ABS(发出成本金额) DESC")) {
                    System.out.println("  | 异常行(发出成本金额 > 10 万):");
                    while (rs.next()) {
                        System.out.println("  | " + rs.getString("仓库键") + " / " + rs.getString("存货编码") + " rn=" + rs.getInt("rn")
                                + " 收入=" + rs.getBigDecimal("收入数量") + " 发出=" + rs.getBigDecimal("发出数量")
                                + " 结存=" + rs.getBigDecimal("结存数量") + " 结存金额=" + rs.getBigDecimal("结存金额")
                                + " 发出成本=" + rs.getBigDecimal("发出成本金额"));
                    }
                }
            } finally {
                c.rollback();
                System.out.println("[ROLLBACK] 事务已回滚,数据未改");
            }
        }
    }

    static final String STEP_S =
            "SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,"
          + " ISNULL(收入数量,0) AS 收入数量, ISNULL(发出数量,0) AS 发出数量, ISNULL(收入金额,0) AS 收入金额,"
          + " ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn"
          + " INTO #s FROM dbo.v_stock_movement";

    /** 新路径:递归段对着带聚簇索引的 #s */
    static final String REC_NEW_INTO =
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
          + ") SELECT * INTO #new FROM rec OPTION (MAXRECURSION 0)";

    /** 旧路径:递归段每轮现场查视图(就是慢 137 s 的那版,只补 ISNULL 让它能跑完) */
    static final String REC_OLD_INTO =
            "WITH s AS ("
          + " SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,"
          + " ISNULL(收入数量,0) AS 收入数量, ISNULL(发出数量,0) AS 发出数量, ISNULL(收入金额,0) AS 收入金额,"
          + " ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn"
          + " FROM dbo.v_stock_movement"
          + "), rec AS ("
          + " SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,"
          + " CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,"
          + " CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额,"
          + " CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 发出成本金额,"
          + " CAST(收入数量 AS decimal(38,10)) AS 收入数量, CAST(发出数量 AS decimal(38,10)) AS 发出数量, CAST(收入金额 AS decimal(38,10)) AS 收入金额"
          + " FROM s WHERE rn = 1"
          + " UNION ALL"
          + " SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,"
          + " CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),"
          + " CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),"
          + " CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),"
          + " CAST(s.收入数量 AS decimal(38,10)), CAST(s.发出数量 AS decimal(38,10)), CAST(s.收入金额 AS decimal(38,10))"
          + " FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1"
          + ") SELECT * INTO #old FROM rec OPTION (MAXRECURSION 0)";

    static void drop(Statement st) throws SQLException {
        for (String t : new String[]{"#s", "#new", "#old"}) {
            st.execute("IF OBJECT_ID('tempdb.." + t + "') IS NOT NULL DROP TABLE " + t);
        }
    }

    static int scalar(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? rs.getInt(1) : -1; }
    }
}
