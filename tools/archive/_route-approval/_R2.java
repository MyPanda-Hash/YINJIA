package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _R2: 跑迁移前核对 yj_doc_status / bs_route / plang 的列与触发器现状。 */
public class _R2 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_route-approval\\_r2.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① yj_doc_status 列 ===");
            q(w, c, "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS"
                    + " WHERE TABLE_NAME=N'yj_doc_status' ORDER BY ORDINAL_POSITION");

            p(w, "\n=== ② bs_route 列 ===");
            q(w, c, "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS"
                    + " WHERE TABLE_NAME=N'bs_route' ORDER BY ORDINAL_POSITION");

            p(w, "\n=== ③ plang 工艺路线 列 + 触发器 ===");
            q(w, c, "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS"
                    + " WHERE TABLE_NAME=N'plang' AND COLUMN_NAME IN (N'工艺路线',N'批次号')");
            q(w, c, "SELECT name, type_desc FROM sys.triggers WHERE name LIKE N'%route%'");
            q(w, c, "SELECT OBJECT_NAME(parent_object_id) AS tbl, name FROM sys.default_constraints"
                    + " WHERE OBJECT_NAME(parent_object_id) IN (N'bs_route',N'yj_doc_status')");

            p(w, "\n=== ④ 已被工单使用的路线 + 审核状态(基线目标)===");
            q(w, c, "SELECT u.工艺路线编码,"
                    + " (SELECT COUNT(*) FROM dbo.plang p WHERE p.[工艺路线]=u.工艺路线编码"
                    + "    AND ISNULL(p.asp_cancel,'N')<>'Y') AS 工单行数,"
                    + " s.shr, CASE WHEN s.shr IS NOT NULL THEN N'Y' ELSE N'N' END AS 已审核,"
                    + " ISNULL(s.canceled,'N') canceled, ISNULL(s.stopped,'N') stopped,"
                    + " ISNULL(s.pending,'N') pending"
                    + " FROM (SELECT DISTINCT p.[工艺路线] AS 工艺路线编码 FROM dbo.plang p"
                    + "        WHERE ISNULL(p.[工艺路线],N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y') u"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=u.工艺路线编码"
                    + " ORDER BY u.工艺路线编码");

            p(w, "\n=== ⑤ 未被工单使用的路线(不许被补审)===");
            q(w, c, "SELECT r.工艺路线编码, r.工艺路线名称, s.shr"
                    + " FROM dbo.bs_route r"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code='ROUTE' AND s.doc_no=r.工艺路线编码"
                    + " WHERE r.工艺路线编码 NOT IN (SELECT p.[工艺路线] FROM dbo.plang p"
                    + "                              WHERE ISNULL(p.[工艺路线],N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y')"
                    + " ORDER BY r.工艺路线编码");
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
