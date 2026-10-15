package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P2: 表头/明细数量列的物理类型 + 检验数量 取值分布 + 译名覆盖。 */
public class _P2 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p2.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① 头/明细 数量列 物理类型 ===");
            q(w, c, "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE"
                    + " FROM INFORMATION_SCHEMA.COLUMNS"
                    + " WHERE TABLE_NAME IN (N'qc_mold_insp_head',N'qc_cut_insp_head',N'qc_asm_insp_head',"
                    + " N'qc_mold_insp_detail',N'qc_cut_insp_detail',N'qc_asm_insp_detail')"
                    + " AND (COLUMN_NAME LIKE N'%数量%')"
                    + " ORDER BY TABLE_NAME, COLUMN_NAME");

            p(w, "\n=== ② 检验数量 取值分布(NULL / 0 / >0) ===");
            q(w, c, "SELECT * FROM ("
                    + " SELECT N'QC_MOLD_INSP' AS 面板, COUNT(*) 单数,"
                    + "   SUM(CASE WHEN 检验数量 IS NULL THEN 1 ELSE 0 END) 空,"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)=0 THEN 1 ELSE 0 END) 零,"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)>0 THEN 1 ELSE 0 END) 有值 FROM qc_mold_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_CUT_INSP', COUNT(*),"
                    + "   SUM(CASE WHEN 检验数量 IS NULL THEN 1 ELSE 0 END),"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)=0 THEN 1 ELSE 0 END),"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)>0 THEN 1 ELSE 0 END) FROM qc_cut_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_ASM_INSP', COUNT(*),"
                    + "   SUM(CASE WHEN 检验数量 IS NULL THEN 1 ELSE 0 END),"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)=0 THEN 1 ELSE 0 END),"
                    + "   SUM(CASE WHEN ISNULL(检验数量,0)>0 THEN 1 ELSE 0 END) FROM qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + ") t ORDER BY 面板");

            p(w, "\n=== ③ 译名覆盖:field/结论相关 ===");
            q(w, c, "SELECT scope, ref_key, locale, text, source FROM yj_translation"
                    + " WHERE scope='field' AND ref_key IN (N'合格数量',N'不合格数量',N'检验数量',N'送检数量',N'总结论',N'判定')"
                    + " ORDER BY ref_key, locale");

            p(w, "\n=== ④ yj_translation 里是否已有 未检验/全部合格/缺检/存在不合格 ===");
            q(w, c, "SELECT scope, ref_key, locale, text, source FROM yj_translation"
                    + " WHERE ref_key IN (N'未检验',N'全部合格',N'缺检',N'存在不合格',N'未判定')"
                    + " ORDER BY ref_key, locale");
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
