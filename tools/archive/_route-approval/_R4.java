package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _R4: 找出一个已审核订单行，验证 requireRouteAudited 的两侧：未审核拒绝 / 已审核放行。 */
public class _R4 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_route-approval\\_r4.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① 已审核订单 + 剩余量 > 0 的行(可作 toManu 入参)===");
            q(w, c, "SELECT TOP 6 o.[单据编号] AS 订单号, l.[id] AS 行id,"
                    + " ISNULL(l.[数量],0) AS 数量, ISNULL(rv.[工艺路线],N'') AS 产品绑定路线,"
                    + " ISNULL((SELECT SUM(ISNULL(f.linked_quantity,0)) FROM form_flow_link f"
                    + "   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key=o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))"
                    + "     AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE'),0) AS 已占用"
                    + " FROM bd_so_order o"
                    + " JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'"
                    + " LEFT JOIN bs_inv rv ON rv.[存货编码]=l.[存货编码] AND ISNULL(rv.asp_cancel,'N')<>'Y'"
                    + " JOIN yj_doc_status s ON s.panel_code='SO_ORDER' AND s.doc_no=o.[单据编号] AND s.shr IS NOT NULL"
                    + "   AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.pending,'N')<>'Y'"
                    + " WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND ISNULL(l.[数量],0) >"
                    + "   ISNULL((SELECT SUM(ISNULL(f.linked_quantity,0)) FROM form_flow_link f"
                    + "     WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key=o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))"
                    + "       AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE'),0)"
                    + " ORDER BY o.[单据日期] DESC");

            p(w, "\n=== ② 未审核路线清单(应被 toManu 拒绝)===");
            q(w, c, "SELECT DISTINCT r.工艺路线编码, MAX(ISNULL(r.工艺路线名称,N'')) AS 名称"
                    + " FROM dbo.bs_route r"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码"
                    + " WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.工序名称,N'')<>N''"
                    + "   AND (s.shr IS NULL OR ISNULL(s.canceled,'N')='Y' OR ISNULL(s.stopped,'N')='Y'"
                    + "     OR ISNULL(s.deleting,'N')='Y' OR ISNULL(s.modify_state,'N')='Y')"
                    + " GROUP BY r.工艺路线编码 ORDER BY r.工艺路线编码");
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
