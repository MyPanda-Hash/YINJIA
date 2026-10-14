package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** _P6: 用与 ScheduleBoardService 完全相同的新口径跑质检段查询,核对追溯页会显示什么。 */
public class _P6 {
    static final String[] TBL = {"qc_mold_insp_head", "qc_cut_insp_head", "qc_asm_insp_head"};
    static final String[] PANEL = {"QC_MOLD_INSP", "QC_CUT_INSP", "QC_ASM_INSP"};
    static final String[] OPS = {"成型", "切炭", "组装"};

    public static void main(String[] args) throws Exception {
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_insp-passqty\\_p6.txt";
        try (BufferedWriter w = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8);
             Connection c = DriverManager.getConnection(
                     "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + args[0] + ";encrypt=false",
                     System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

            double passSum = 0, ngSum = 0, inspSum = 0;
            java.util.Set<String> doneOps = new java.util.LinkedHashSet<>();

            p(w, "=== ① 逐单结果(新口径:合格数 = 检验数量 − Σ不合格;未检验 → NULL)===");
            w.write("面板\t单号\t工序\t状态\t送检(报工)\t检验\t不合格\t合格\t结论行"); w.newLine();
            for (int i = 0; i < TBL.length; i++) {
                List<Map<String, Object>> rs = q(c,
                        "SELECT h.单据编号, ISNULL(h.工序,N'') AS 工序, ISNULL(h.报工数量,0) AS 报工数量,"
                        + " ISNULL(h.检验数量,0) AS 检验数量,"
                        + " CASE WHEN ISNULL(h.检验数量,0) <= 0 THEN NULL"
                        + "      WHEN ISNULL(h.检验数量,0) - ISNULL(d.ng,0) < 0 THEN 0"
                        + "      ELSE ISNULL(h.检验数量,0) - ISNULL(d.ng,0) END AS 合格数量,"
                        + " ISNULL(d.ng,0) AS 不合格数量,"
                        + " CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
                        + "      WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                        + "      WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'"
                        + "      WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态"
                        + " FROM dbo." + TBL[i] + " h"
                        + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code=? AND s.doc_no=h.单据编号"
                        + " LEFT JOIN (SELECT 单据编号, SUM(ISNULL(不合格数量,0)) AS ng FROM dbo."
                        + TBL[i].replace("_head", "_detail")
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号) d ON d.单据编号=h.单据编号"
                        + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.工单号=? ORDER BY h.单据编号",
                        PANEL[i], args[1]);
                for (Map<String, Object> m : rs) {
                    Object pass = m.get("合格数量");
                    String line = PANEL[i] + "\t" + m.get("单据编号") + "\t" + m.get("工序") + "\t"
                            + m.get("单据状态") + "\t" + m.get("报工数量") + "\t" + m.get("检验数量") + "\t"
                            + m.get("不合格数量") + "\t" + (pass == null ? "NULL(不显示)" : String.valueOf(pass));
                    w.write(line); w.newLine();
                    String op = String.valueOf(m.get("工序")).trim();
                    if (!op.isEmpty() && !"已作废".equals(m.get("单据状态"))) doneOps.add(op);
                    // 汇总按 Num.of(NULL)=0
                    passSum += pass == null ? 0 : ((Number) pass).doubleValue();
                    ngSum += ((Number) m.get("不合格数量")).doubleValue();
                    inspSum += ((Number) m.get("检验数量")).doubleValue();
                }
            }

            p(w, "\n=== ② 汇总结论(与 ScheduleBoardService 同逻辑)===");
            java.util.List<String> miss = new java.util.ArrayList<>();
            for (String op : OPS) if (!doneOps.contains(op)) miss.add(op);
            String concl = ngSum > 0 ? "存在不合格"
                    : (inspSum <= 0 ? "未检验" : (miss.isEmpty() ? "全部合格" : "缺检"));
            w.write("应检工序=" + java.util.Arrays.toString(OPS) + "\n");
            w.write("已检工序=" + doneOps + "\n缺检工序=" + miss + "\n");
            w.write("检验数量合计=" + inspSum + " 合格数量合计=" + passSum + " 不合格数量合计=" + ngSum + "\n");
            w.write("=> 结论 = " + concl + "\n");

            p(w, "\n=== ③ 老口径对比(会算出什么)===");
            List<Map<String, Object>> old = q(c, "SELECT h.单据编号, ISNULL(h.报工数量,0)-ISNULL(d.ng,0) AS 旧合格"
                    + " FROM dbo.qc_asm_insp_head h"
                    + " LEFT JOIN (SELECT 单据编号, SUM(ISNULL(不合格数量,0)) ng FROM dbo.qc_asm_insp_detail"
                    + "            WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号) d ON d.单据编号=h.单据编号"
                    + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.工单号=? ORDER BY h.单据编号", args[1]);
            w.write("旧口径(报工数量−Σ不合格):"); w.newLine();
            for (Map<String, Object> m : old) w.write("  " + m.get("单据编号") + " → " + m.get("旧合格") + "\n");
        }
    }

    static List<Map<String, Object>> q(Connection c, String sql, Object... args) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                List<Map<String, Object>> out = new java.util.ArrayList<>();
                ResultSetMetaData m = rs.getMetaData();
                while (rs.next()) {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    for (int i = 1; i <= m.getColumnCount(); i++) row.put(m.getColumnLabel(i), rs.getObject(i));
                    out.add(row);
                }
                return out;
            }
        }
    }

    static void p(BufferedWriter w, String s) throws Exception { w.write(s); w.newLine(); w.flush(); }
}
