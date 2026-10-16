package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P1: 工序检验单 合格数量 现状盘点:字段登记 / 表头数量 / 明细数量 / 数据一致性。 */
public class _P1 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p1.txt";
        Files.createDirectories(Paths.get(out).getParent());
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① yj_field: 合格/不合格/报工数量/检验数量 登记 ===");
            q(w, c, "SELECT panel_code, label, place, seq, visible, hidden, editable, data_type"
                    + " FROM yj_field WHERE label IN (N'合格数量',N'不合格数量',N'报工数量',N'检验数量',N'送检数量')"
                    + " ORDER BY label, panel_code, place, seq");

            p(w, "\n=== ② 表头数量列现状(近 12 张) ===");
            q(w, c, "SELECT * FROM ("
                    + " SELECT N'QC_MOLD_INSP' AS 面板, 单据编号, 报工数量, 检验数量, 单据状态, 工单号, 工序 FROM qc_mold_insp_head"
                    + " UNION ALL SELECT N'QC_CUT_INSP', 单据编号, 报工数量, 检验数量, 单据状态, 工单号, 工序 FROM qc_cut_insp_head"
                    + " UNION ALL SELECT N'QC_ASM_INSP', 单据编号, 报工数量, 检验数量, 单据状态, 工单号, 工序 FROM qc_asm_insp_head"
                    + ") t ORDER BY 面板, 单据编号 DESC");

            p(w, "\n=== ③ 明细数量现状(未作废) ===");
            q(w, c, "SELECT * FROM ("
                    + " SELECT N'QC_MOLD_INSP' AS 面板, 单据编号, 检验项目, 表区, 合格数量, 不合格数量, 数量 FROM qc_mold_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_CUT_INSP', 单据编号, 检验项目, 表区, 合格数量, 不合格数量, 数量 FROM qc_cut_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_ASM_INSP', 单据编号, 检验项目, 表区, 合格数量, 不合格数量, 数量 FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + ") t ORDER BY 面板, 单据编号, 检验项目");

            p(w, "\n=== ④ 一致性:合格(报工-Σ不合格) vs 检验数量 是否越界 ===");
            q(w, c, "SELECT 面板, 单据编号, 报工数量, 检验数量, 不合格合计,"
                    + " CASE WHEN 报工数量 - 不合格合计 < 0 THEN 0 ELSE 报工数量 - 不合格合计 END AS 合格派生,"
                    + " CASE WHEN 报工数量 - 不合格合计 > 检验数量 THEN N'越界(合格>检验)'"
                    + "      WHEN 检验数量 = 0 THEN N'未检验' ELSE N'ok' END AS 判定 FROM ("
                    + " SELECT N'QC_MOLD_INSP' AS 面板, h.单据编号, ISNULL(h.报工数量,0) 报工数量, ISNULL(h.检验数量,0) 检验数量,"
                    + "   (SELECT SUM(ISNULL(不合格数量,0)) FROM qc_mold_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') 不合格合计"
                    + " FROM qc_mold_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_CUT_INSP', h.单据编号, ISNULL(h.报工数量,0), ISNULL(h.检验数量,0),"
                    + "   (SELECT SUM(ISNULL(不合格数量,0)) FROM qc_cut_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')"
                    + " FROM qc_cut_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                    + " UNION ALL SELECT N'QC_ASM_INSP', h.单据编号, ISNULL(h.报工数量,0), ISNULL(h.检验数量,0),"
                    + "   (SELECT SUM(ISNULL(不合格数量,0)) FROM qc_asm_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y')"
                    + " FROM qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                    + ") t ORDER BY 面板, 单据编号 DESC");

            p(w, "\n=== ⑤ 清单外:三面板 yj_field 全量(近确认字段布局) ===");
            q(w, c, "SELECT panel_code, label, place, seq, visible, hidden, editable, required, data_type"
                    + " FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP',N'QC_CUT_INSP',N'QC_ASM_INSP')"
                    + " AND (label LIKE N'%数量%' OR label LIKE N'%结论%' OR label LIKE N'%判定%')"
                    + " ORDER BY panel_code, place, seq");

            p(w, "\n=== ⑥ qc_asm_insp_head 下游(入库单) ===");
            q(w, c, "SELECT 单据编号, 报工数量, 检验数量, 工单号 FROM qc_asm_insp_head"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC");
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
