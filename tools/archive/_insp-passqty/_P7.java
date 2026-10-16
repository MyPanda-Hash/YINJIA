package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** _P7: 复现 asmInspToStock 的新口径取数,确认未检验的组装检验单审核时不会再凭报工数量生成全额入库单。 */
public class _P7 {
    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p7.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            p(w, "=== 组装成品检验单:新口径 pass = 检验数量 − Σ不合格(与代码同步)===");
            w.write("单号\t工单\t报工数量\t检验数量\tΣ不合格\t旧口径pass\t新口径pass\t是否产生下游\n");
            try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(
                    "SELECT h.单据编号, ISNULL(h.工单号,N'') 工单号, ISNULL(h.报工数量,0) 报工数量,"
                    + " ISNULL(h.检验数量,0) 检验数量, ISNULL(d.ng,0) 不合格合计,"
                    + " ISNULL(h.报工数量,0) - ISNULL(d.ng,0) AS 旧pass,"
                    + " CASE WHEN ISNULL(h.检验数量,0) - ISNULL(d.ng,0) < 0 THEN 0"
                    + "      ELSE ISNULL(h.检验数量,0) - ISNULL(d.ng,0) END AS 新pass"
                    + " FROM qc_asm_insp_head h"
                    + " LEFT JOIN (SELECT 单据编号, SUM(ISNULL(不合格数量,0)) ng FROM qc_asm_insp_detail"
                    + "             WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号) d"
                    + "   ON d.单据编号=h.单据编号"
                    + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.单据编号 DESC")) {
                while (rs.next()) {
                    double oldP = rs.getDouble("旧pass"), newP = rs.getDouble("新pass");
                    double ng = rs.getDouble("不合格合计");
                    String eff = (newP > 0 || ng > 0)
                            ? (newP > 0 ? "生成入库单(实收=" + newP + ")" : "仅留检验记录")
                            : "不产生任何下游单";
                    w.write(rs.getString("单据编号") + "\t" + rs.getString("工单号") + "\t"
                            + rs.getDouble("报工数量") + "\t" + rs.getDouble("检验数量") + "\t" + ng
                            + "\t" + oldP + "\t" + newP + "\t" + eff + "\n");
                }
            }
            w.flush();
            p(w, "\n=== 当前 form_flow_link 里 QC_ASM_INSP → FINISH_IN 的链(应为 0,未误生成)===");
            q(w, c, "SELECT COUNT(*) AS 链数 FROM form_flow_link"
                    + " WHERE source_panel_code='QC_ASM_INSP' AND target_panel_code='FINISH_IN'");
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
