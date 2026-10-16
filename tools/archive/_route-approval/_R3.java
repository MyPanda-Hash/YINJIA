package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _R3: 复现 requireRouteAudited 判定:哪些路线能转工单。 */
public class _R3 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_route-approval\\_r3.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① 每条路线的审核判定(requireRouteAudited 口径)===");
            w.write("路线\t状态行\tshr\tcanceled\tstopped\tdeleting\tmodify_state\t判定(可转工单?)\n");
            try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(
                    "SELECT r.工艺路线编码,"
                    + " CASE WHEN s.panel_code IS NULL THEN N'无状态行' ELSE N'有' END AS 状态行,"
                    + " ISNULL(s.shr,N'') shr, ISNULL(s.canceled,'N') canceled, ISNULL(s.stopped,'N') stopped,"
                    + " ISNULL(s.deleting,'N') deleting, ISNULL(s.modify_state,'N') modify_state,"
                    + " ISNULL(s.pending,'N') pending"
                    + " FROM (SELECT DISTINCT 工艺路线编码 FROM dbo.bs_route WHERE ISNULL(asp_cancel,'N')<>'Y') r"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码"
                    + " ORDER BY r.工艺路线编码")) {
                while (rs.next()) {
                    boolean audited = !"无状态行".equals(rs.getString("状态行"))
                            && rs.getString("shr") != null && !rs.getString("shr").isBlank()
                            && "N".equals(rs.getString("canceled")) && "N".equals(rs.getString("stopped"))
                            && "N".equals(rs.getString("deleting")) && "N".equals(rs.getString("modify_state"));
                    w.write(rs.getString("工艺路线编码") + "\t" + rs.getString("状态行") + "\t" + rs.getString("shr")
                            + "\t" + rs.getString("canceled") + "\t" + rs.getString("stopped") + "\t"
                            + rs.getString("deleting") + "\t" + rs.getString("modify_state") + "\t"
                            + (audited ? "✅ 可转工单" : "🚫 拒绝") + "(pending=" + rs.getString("pending") + ")\n");
                }
            }

            p(w, "\n=== ② 与 bs_route.审核状态 列一致性 ===");
            q(w, c, "SELECT r.工艺路线编码, r.审核状态,"
                    + " CASE WHEN s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y'"
                    + "      AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.modify_state,'N')<>'Y'"
                    + "      THEN N'已审核' ELSE N'未审核' END AS 派生"
                    + " FROM dbo.bs_route r"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码"
                    + " WHERE r.工艺路线编码 IN (N'GY-CB-STD', N'GY-001', N'GY-2026-10-0003', N'GY-2026-10-0004')"
                    + " GROUP BY r.工艺路线编码, r.审核状态, s.shr, s.canceled, s.stopped, s.deleting, s.modify_state"
                    + " ORDER BY r.工艺路线编码");

            p(w, "\n=== ③ OrderConvert pending 的新列(路线审核状态)===");
            q(w, c, "SELECT TOP 5 o.[单据编号] AS 订单号, ISNULL(rv.[工艺路线],N'') AS 工艺路线,"
                    + " CASE WHEN ISNULL(rv.[工艺路线], N'') = N'' THEN N'未选择'"
                    + "      WHEN rs.shr IS NOT NULL AND ISNULL(rs.canceled,'N')<>'Y'"
                    + "        AND ISNULL(rs.stopped,'N')<>'Y' AND ISNULL(rs.deleting,'N')<>'Y'"
                    + "        AND ISNULL(rs.modify_state,'N')<>'Y' THEN N'已审核'"
                    + "      ELSE N'未审核' END AS 路线审核状态"
                    + " FROM bd_so_order o"
                    + " JOIN bl_so_order l ON l.[单据编号] = o.[单据编号] AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                    + " LEFT JOIN bs_inv rv ON rv.[存货编码] = l.[存货编码] AND ISNULL(rv.asp_cancel,'N') <> 'Y'"
                    + " LEFT JOIN yj_doc_status rs ON rs.panel_code = 'ROUTE' AND rs.doc_no = rv.[工艺路线]"
                    + " JOIN yj_doc_status s ON s.panel_code = 'SO_ORDER' AND s.doc_no = o.[单据编号] AND s.shr IS NOT NULL"
                    + " WHERE ISNULL(o.asp_cancel,'N') <> 'Y' ORDER BY o.[单据日期] DESC");
        }
    }

    static void q(BufferedWriter w, Connection c, String sql) throws Exception {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append('\t');
            w.write(h.toString()); w.newLine();
            int n = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(rs.getString(i)).append('\t');
                w.write(b.toString()); w.newLine(); n++;
            }
            w.write("-- " + n + " row(s)"); w.newLine();
        }
        w.flush();
    }

    static void p(BufferedWriter w, String s) throws Exception { w.write(s); w.newLine(); w.flush(); }
}
