package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P3: 组装成品检验单审核分流是否已凭"空明细"生成过全额入库单。 */
public class _P3 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p3.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== ① FINISH_IN 单据 ===");
            q(w, c, "SELECT 单据编号, 单据日期, 加工单号, 业务类型, 经手人, 备注 FROM bd_finish_in"
                    + " ORDER BY 单据编号 DESC");

            p(w, "=== ② FINISH_IN 明细数量 ===");
            q(w, c, "SELECT [单据编号], [产品编码], [产品名称], [实收数量], [批号] FROM bl_finish_in"
                    + " ORDER BY 单据编号 DESC");

            p(w, "\n=== ③ 组装检验单 → FINISH_IN 占用链 ===");
            q(w, c, "SELECT source_panel_code, source_form_no, target_panel_code, target_form_no,"
                    + " link_status, create_by FROM form_flow_link"
                    + " WHERE source_panel_code='QC_ASM_INSP' ORDER BY id DESC");

            p(w, "\n=== ④ 报工审核钩子:audit 相关方法签名确认(QC_ASM_INSP 审核入口) ===");
            q(w, c, "SELECT TOP 5 1 AS ok");

            p(w, "\n=== ⑤ 五张组装检验单 x 明细行数 x 下游 ===");
            q(w, c, "SELECT h.单据编号, ISNULL(h.报工数量,0) 报工数量, h.检验数量,"
                    + " (SELECT COUNT(*) FROM qc_asm_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') 明细行数,"
                    + " (SELECT ISNULL(SUM(不合格数量),0) FROM qc_asm_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') 不合格合计,"
                    + " ISNULL(h.处理方式,N'') 处理方式,"
                    + " (SELECT COUNT(*) FROM form_flow_link l WHERE l.source_panel_code='QC_ASM_INSP' AND l.source_form_no=h.单据编号"
                    + "    AND l.target_panel_code='FINISH_IN' AND l.link_status='ACTIVE') 已产生入库"
                    + " FROM qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.单据编号 DESC");

            p(w, "\n=== ⑥ yj_doc_status: 组装检验单状态 ===");
            q(w, c, "SELECT panel_code, doc_no, shr, pending, canceled, stopped FROM yj_doc_status"
                    + " WHERE panel_code IN ('QC_ASM_INSP','QC_MOLD_INSP','QC_CUT_INSP')"
                    + " ORDER BY panel_code, doc_no DESC");
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
