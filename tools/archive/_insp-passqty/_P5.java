package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P5: 复现 migrate-insp-pass-qty-consistency 的三条自检,逐项看哪条不过。 */
public class _P5 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p5.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① 六张表 合格数量 注明现状 ===");
            q(w, c, "SELECT t.name AS 表, c.name AS 列, CAST(ep.value AS nvarchar(max)) AS 注明"
                    + " FROM sys.extended_properties ep"
                    + " JOIN sys.tables t ON t.object_id = ep.major_id"
                    + " JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id"
                    + " WHERE t.name LIKE N'qc_%insp%' AND c.name = N'合格数量' AND ep.name = N'MS_Description'"
                    + " ORDER BY t.name");

            p(w, "\n=== ② 自检(a):含「检验数量」字样的表数(应为 6) ===");
            q(w, c, "SELECT COUNT(*) AS 命中 FROM sys.extended_properties ep"
                    + " JOIN sys.tables t ON t.object_id = ep.major_id"
                    + " JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id"
                    + " WHERE t.name IN (N'qc_mold_insp_head',N'qc_mold_insp_detail',"
                    + " N'qc_cut_insp_head',N'qc_cut_insp_detail',"
                    + " N'qc_asm_insp_head',N'qc_asm_insp_detail')"
                    + " AND c.name = N'合格数量' AND ep.name = N'MS_Description'"
                    + " AND CAST(ep.value AS nvarchar(max)) LIKE N'%检验数量%'");

            p(w, "\n=== ③ 自检(b):物理列是否都在 ===");
            q(w, c, "SELECT N'qc_mold_insp_detail' t, COL_LENGTH(N'dbo.qc_mold_insp_detail',N'合格数量') col"
                    + " UNION ALL SELECT N'qc_cut_insp_detail', COL_LENGTH(N'dbo.qc_cut_insp_detail',N'合格数量')"
                    + " UNION ALL SELECT N'qc_asm_insp_detail', COL_LENGTH(N'dbo.qc_asm_insp_detail',N'合格数量')"
                    + " UNION ALL SELECT N'qc_insp_detail', COL_LENGTH(N'dbo.qc_insp_detail',N'合格数量')");

            p(w, "\n=== ④ 自检(c):来料检验单 QC_INSP 字段是否在 ===");
            q(w, c, "SELECT panel_code, label, place FROM yj_field"
                    + " WHERE panel_code=N'QC_INSP' AND label=N'合格数量'");
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
