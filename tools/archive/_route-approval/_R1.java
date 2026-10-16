package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _R1: 工艺路线 ROUTE 面板 + bs_route 数据 现状盘点。 */
public class _R1 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_route-approval\\_r1.txt";
        Files.createDirectories(Paths.get(out).getParent());
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① yj_panel: ROUTE 面板登记(是否走审核流: mode=doc) ===");
            q(w, c, "SELECT panel_code, panel_name, mode, category, line_table, head_table, group_col,"
                    + " pk_col, code_col, prefix, date_col, detail_key, module_group"
                    + " FROM yj_panel WHERE panel_code IN (N'ROUTE', N'OP', N'INV', N'PROD_LINE')");

            p(w, "\n=== ①b yj_ 表清单(找按钮/动作登记表) ===");
            q(w, c, "SELECT name FROM sys.tables WHERE name LIKE N'yj_%' ORDER BY name");

            p(w, "\n=== ①c yj_button(若有)ROUTE 的动作 ===");
            try { q(w, c, "SELECT * FROM yj_button WHERE panel_code=N'ROUTE'"); }
            catch (Exception e) { w.write("-- " + e.getMessage()); w.newLine(); }

            p(w, "\n=== ② yj_field: ROUTE 全量字段 ===");
            q(w, c, "SELECT col_name, label, place, seq, visible, hidden, editable, required, data_type"
                    + " FROM yj_field WHERE panel_code=N'ROUTE' ORDER BY place, seq");

            p(w, "\n=== ③ bs_route 数据 + yj_doc_status 审核状态 ===");
            q(w, c, "SELECT r.工艺路线编码, r.工艺路线名称, r.状态, r.审核状态,"
                    + " s.shr AS 审核人,"
                    + " CASE WHEN s.shr IS NOT NULL THEN N'Y' ELSE N'N' END AS 已审核,"
                    + " ISNULL(s.pending,'N') pending,"
                    + " ISNULL(s.canceled,'N') canceled, ISNULL(s.archived,'N') archived,"
                    + " (SELECT COUNT(*) FROM bs_route d WHERE d.工艺路线编码=r.工艺路线编码"
                    + "   AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行数"
                    + " FROM bs_route r"
                    + " LEFT JOIN yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码"
                    + " WHERE ISNULL(r.asp_cancel,'N')<>'Y' ORDER BY r.工艺路线编码");
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
