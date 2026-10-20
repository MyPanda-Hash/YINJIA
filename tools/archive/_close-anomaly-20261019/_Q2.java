import java.io.*;
import java.sql.*;

/** 只读:把本次改动的 SQL 片段逐条打到库里,验语法与结果(2026-10-19)。 */
public class _Q2 {
    static PrintStream out;
    static final String LEGACY = "GD2608";

    static String closed(String a) {
        return "(ISNULL(" + a + ".ja,'N') IN (N'T',N'Y')"
                + " AND ((ISNULL(" + a + ".pl_sl,0) > 0 AND ISNULL(" + a + ".rk_sl,0) >= ISNULL(" + a + ".pl_sl,0))"
                + "      OR " + a + ".pl_no LIKE N'" + LEGACY + "%'))";
    }
    static String notClosed(String a) { return "NOT " + closed(a); }
    static String anomaly(String a) { return "(ISNULL(" + a + ".ja,'N') IN (N'T',N'Y') AND " + notClosed(a) + ")"; }
    static String anomalyFlag(String a) { return "CASE WHEN " + anomaly(a) + " THEN N'Y' ELSE N'N' END"; }

    public static void main(String[] args) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            run(c, "A 列表:结案异常列(anomalyFlag)",
                    "SELECT TOP 3 p.pl_no AS 工单号, p.pl_xc AS 行号, " + anomalyFlag("p") + " AS 结案异常 FROM dbo.plang p");
            run(c, "A2 列表:结案 + 异常 同屏",
                    "SELECT COUNT(*) AS 总行,"
                            + " SUM(CASE WHEN " + closed("p") + " THEN 1 ELSE 0 END) AS 已结案,"
                            + " SUM(CASE WHEN " + anomaly("p") + " THEN 1 ELSE 0 END) AS 结案异常"
                            + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'");
            run(c, "B 体检:ANOMALY_WHERE",
                    "SELECT COUNT(*) AS 异常行 FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND " + anomaly("p"));
            String anyNo = one(c, "SELECT TOP 1 pl_no FROM dbo.plang ORDER BY id");
            run(c, "C 转领料单:代表行查询 + 排序",
                    "SELECT id, pl_no, ISNULL(pl_xc, 0) AS xc, ISNULL([批次号], N'') AS batch,"
                            + " ISNULL(dm, N'') AS dm, ISNULL(scx, N'') AS scx, ISNULL(pl_sl, 0) AS pl_sl,"
                            + " ISNULL(rk_sl, 0) AS rk_sl, ISNULL(ja, N'N') AS ja"
                            + " FROM dbo.plang p WHERE pl_no = ? AND ISNULL(pl_xc,0) = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + " ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END,"
                            + "          CASE WHEN ISNULL(pl_sl,0) > 0 THEN 0 ELSE 1 END,"
                            + "          CASE WHEN " + closed("p") + " THEN 1 ELSE 0 END, id", anyNo, 1, -1L);
            run(c, "D 追溯:agg + 结案行数",
                    "SELECT COUNT(*) AS 行数, ISNULL(SUM(ISNULL(pl_sl,0)),0) AS 排产数量,"
                            + " ISNULL(SUM(ISNULL(xq_sl,0)),0) AS 需求数量, ISNULL(SUM(ISNULL(rk_sl,0)),0) AS 入库数量,"
                            + " COUNT(DISTINCT NULLIF(ISNULL(scx,N''), N'')) AS 产线数,"
                            + " MAX(NULLIF(ISNULL(scx,N''), N'')) AS 任一产线,"
                            + " SUM(CASE WHEN " + closed("p") + " THEN 1 ELSE 0 END) AS 结案行数"
                            + " FROM dbo.plang p WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y'", anyNo);
            run(c, "E 追溯:子单状态",
                    "SELECT pl_no AS 工单号, pl_xc AS 工单行号, ISNULL([批次号],N'') AS 批次号,"
                            + " ISNULL(pl_sl,0) AS 排产数量, [拆分序号] AS 拆分序号,"
                            + " CASE WHEN " + closed("p") + " THEN N'已结案' ELSE N'在产' END AS 状态"
                            + " FROM dbo.plang p WHERE [源工单号]=? AND ISNULL(asp_cancel,'N')<>'Y'", anyNo);
            run(c, "F 追溯:家族 CTE",
                    "WITH up AS (SELECT p.id, p.[源工单行id] FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + "  UNION ALL SELECT p.id, p.[源工单行id] FROM dbo.plang p JOIN up u ON p.id = u.[源工单行id]"
                            + "    WHERE ISNULL(p.asp_cancel,'N')<>'Y'),"
                            + " root AS (SELECT TOP 1 id FROM up WHERE [源工单行id] IS NULL ORDER BY id),"
                            + " fam AS (SELECT p.* FROM dbo.plang p WHERE p.id IN (SELECT id FROM root)"
                            + "  UNION ALL SELECT p.* FROM dbo.plang p JOIN fam f ON p.[源工单行id] = f.id WHERE ISNULL(p.asp_cancel,'N')<>'Y')"
                            + " SELECT pl_no AS 工单号, ISNULL(pl_sl,0) AS 计划数量, ISNULL(rk_sl,0) AS 入库数量,"
                            + "   CASE WHEN " + closed("fam") + " THEN N'已结案' ELSE N'在产' END AS 状态"
                            + " FROM fam", 47L);
            run(c, "G 首页流程看板",
                    "SELECT COUNT(*) AS 未排产 FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " AND ISNULL(p.scx,N'')=N'' AND NOT (" + closed("p") + ")");
            run(c, "H 撤回切单/调拨:带 pl_no 的行查询",
                    "SELECT id, ISNULL(pl_xc,0) AS pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_sl,0) AS pl_sl,"
                            + " ISNULL(rk_sl,0) AS rk_sl, ISNULL(pl_no,N'') AS pl_no, ISNULL(ja,'N') AS ja"
                            + " FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", 47L);
            run(c, "I 排产看板:待排产笔数(poolCount)",
                    "SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND " + notClosed("p")
                            + " AND ISNULL(p.scx, N'') = N'' AND NOT (ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工'))");
        }
    }

    static String one(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getString(1) : "";
        }
    }

    static void run(Connection c, String label, String sql, Object... args) {
        out.println("\n---- " + label + " ----");
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) {
                if (args[i] instanceof Long l) ps.setLong(i + 1, l);
                else if (args[i] instanceof Integer n) ps.setInt(i + 1, n);
                else ps.setString(i + 1, String.valueOf(args[i]));
            }
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData m = rs.getMetaData();
                int n = m.getColumnCount();
                StringBuilder h = new StringBuilder();
                for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
                out.println(h);
                int rows = 0;
                while (rs.next() && rows < 8) {
                    StringBuilder b = new StringBuilder();
                    for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                    out.println(b);
                    rows++;
                }
                out.println("(OK, " + rows + " 行)");
            }
        } catch (SQLException e) {
            out.println("[SQL 失败] " + e.getMessage());
        }
    }
}
