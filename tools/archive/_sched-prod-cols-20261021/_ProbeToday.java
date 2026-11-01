// _ProbeToday.java — 一次性探针(2026-10-21):把 ScheduleBoardService.today() 的新 SQL(加产品编号/品名/型号)
// 逐字贴出来在正式账套上跑一遍,确认 ①语法通过 ②列真的有值 ③关键字按型号也能命中。
// 用法(tools 目录): %JAVA25% -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_sched-prod-cols-20261021\_ProbeToday.java
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class _ProbeToday {
    static final String DONE_ROW = "ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工')";
    static final String CLOSED = "(ISNULL(p.ja,'N') IN (N'T',N'Y')"
            + " AND ((ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))"
            + "      OR p.pl_no LIKE N'GD2608%'))";
    static final String NOT_CLOSED = "NOT (" + CLOSED + ")";
    static final String ST_EXPR = "CASE WHEN " + CLOSED + " THEN N'已结案'"
            + " WHEN " + DONE_ROW + " THEN N'完工'"
            + " WHEN ISNULL(p.rk_sl,0) > 0 THEN N'在产' ELSE N'未完工' END";

    static String sql(boolean all) {
        return "SELECT ISNULL(p.scx,N'') AS 生产线, p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号,"
                + " ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.lb,N'') AS 排产班组,"
                + " ISNULL(p.dm,N'') AS 产品编号, ISNULL(p.mc,N'') AS 品名, ISNULL(p.gg,N'') AS 型号,"
                + " " + ST_EXPR + " AS 生产状态,"
                + " ISNULL(p.pl_sl,0) AS 排产数量,"
                + " ISNULL(p.xq_sl,0) AS 需求数量, ISNULL(p.rk_sl,0) AS 入库数量,"
                + " ISNULL(p.xq_sl,0) - ISNULL((SELECT SUM(l.linked_quantity) FROM form_flow_link l"
                + "   WHERE l.source_panel_code = 'SO_ORDER' AND l.source_form_no = p.od_no"
                + "     AND l.source_line_key = p.od_no + N'#' + CONVERT(nvarchar(20), CONVERT(int, p.od_xc))"
                + "     AND l.link_status = 'ACTIVE'), 0) AS 余量,"
                + " CONVERT(varchar(10), p.st_date, 120) AS 预开工日,"
                + " CONVERT(varchar(10), p.cp_date, 120) AS 预完工日,"
                + " (SELECT STUFF((SELECT N' → ' + x.工序 + N':' + ISNULL(NULLIF(x.计划生产线,N''),N'待定')"
                + "   FROM dbo.wo_process_line x WHERE x.工单号=p.pl_no AND ISNULL(x.asp_cancel,'N')<>N'Y'"
                + "   ORDER BY ISNULL(x.工序序,999) FOR XML PATH('')),1,3,N'')) AS 计划线"
                + " FROM dbo.plang p"
                + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'') <> N''"
                + "   AND " + NOT_CLOSED
                + (all ? "" : " AND CONVERT(varchar(10), p.asp_time2, 120) = CONVERT(varchar(10), GETDATE(), 120)")
                + "   AND (? = '' OR p.pl_no LIKE ? OR p.scx LIKE ? OR p.dm LIKE ? OR p.mc LIKE ?"
                + "        OR p.gg LIKE ? OR ISNULL(p.[批次号],N'') LIKE ?)"
                + "   AND (? IS NULL OR ISNULL(p.pl_xc,0) = ?)"
                + "   AND (? = N'' OR EXISTS (SELECT 1 FROM bs_prod_line pl WHERE pl.生产线 = p.scx"
                + "        AND ISNULL(pl.asp_cancel,'N')<>'Y' AND ISNULL(pl.生产车间,N'') = ?))"
                + " ORDER BY p.scx, p.pl_no, p.pl_xc, p.[批次号]";
    }

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[db] " + db);
            run(c, "全部已排产(mode=all,无关键字)", true, "", null);
            run(c, "关键字=型号片段 40.5*16*80", true, "40.5*16*80", null);
            run(c, "关键字=产品编号 A-32-33", true, "A-32-33", null);
            run(c, "关键字=工单号#行号 GD-2026-10-0202#6", true, "GD-2026-10-0202#6", null);
            run(c, "关键字=品名片段 阻垢", true, "阻垢", null);
            run(c, "今日已排产(mode=today)", false, "", null);
        }
    }

    static void run(Connection c, String label, boolean all, String kw, String ws) throws SQLException {
        String like = "%" + kw + "%";
        String noLike = like;
        Integer xcEq = null;
        int i = kw.indexOf('#');
        if (i > 0 && i < kw.length() - 1) {
            String no = kw.substring(0, i).trim(), x = kw.substring(i + 1).trim();
            try { xcEq = Integer.parseInt(x); noLike = "%" + no + "%"; } catch (NumberFormatException ignore) { }
        }
        String w = ws == null ? "" : ws;
        List<Object> a = new ArrayList<>();
        a.add(kw); a.add(noLike); a.add(like); a.add(like); a.add(like); a.add(like); a.add(like);
        a.add(xcEq); a.add(xcEq); a.add(w); a.add(w);
        try (PreparedStatement ps = c.prepareStatement(sql(all))) {
            for (int k = 0; k < a.size(); k++) ps.setObject(k + 1, a.get(k));
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                int n = md.getColumnCount();
                StringBuilder h = new StringBuilder();
                for (int k = 1; k <= n; k++) h.append(k > 1 ? " | " : "").append(md.getColumnLabel(k));
                System.out.println("\n### " + label);
                int total = 0;
                while (rs.next()) {
                    if (total == 0) System.out.println(h);
                    if (total < 6) {
                        StringBuilder b = new StringBuilder();
                        for (int k = 1; k <= n; k++) b.append(k > 1 ? " | " : "").append(rs.getString(k));
                        System.out.println(b);
                    }
                    total++;
                }
                System.out.println("[行数] " + total);
            }
        }
    }
}
