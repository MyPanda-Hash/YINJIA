package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 核实:①bs_qc_item 全部项目名称 ②检验单明细的「表区」实际取值 ③是否有炭棒类检验项。 */
public class QcProbe5 {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\probe5.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("=== ① bs_qc_item 全部项目(名称 + 所属方案) ===");
                q(c, "SELECT 序号, 项目编码, 项目名称, 检验内容, 检验标准, 方案编码 FROM bs_qc_item"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 方案编码, 序号");

                p("\n=== ② 检验单明细的「表区」实际取值分布 ===");
                q(c, "SELECT 'qc_mold_insp_detail' AS t, 表区, COUNT(*) AS n FROM qc_mold_insp_detail GROUP BY 表区"
                    + " UNION ALL SELECT 'qc_cut_insp_detail', 表区, COUNT(*) FROM qc_cut_insp_detail GROUP BY 表区"
                    + " UNION ALL SELECT 'qc_asm_insp_detail', 表区, COUNT(*) FROM qc_asm_insp_detail GROUP BY 表区");

                p("\n=== ③ 是否已有炭棒类检验项(外观/尺寸/重量/强度/黑水) ===");
                q(c, "SELECT 项目编码, 项目名称 FROM bs_qc_item WHERE 项目名称 LIKE N'%外观%'"
                    + " OR 项目名称 LIKE N'%尺寸%' OR 项目名称 LIKE N'%重量%'"
                    + " OR 项目名称 LIKE N'%强度%' OR 项目名称 LIKE N'%黑水%' OR 项目名称 LIKE N'%寿命%'");

                p("\n=== ④ 检验单明细里「检验项目」实际出现过的值 ===");
                q(c, "SELECT 检验项目, COUNT(*) AS n FROM qc_mold_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " GROUP BY 检验项目 UNION ALL"
                    + " SELECT 检验项目, COUNT(*) FROM qc_cut_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验项目 UNION ALL"
                    + " SELECT 检验项目, COUNT(*) FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验项目");

                p("\n=== ⑤ 成型检验单头 检验方案/文件编码/执行标准 实际取值 ===");
                q(c, "SELECT TOP 10 单据编号, 检验方案, 文件编码, 执行标准, 总结论 FROM qc_mold_insp_head ORDER BY id DESC");

                p("\n=== ⑥ 检验单明细的「检验方法」样例(看方法是否已落库) ===");
                q(c, "SELECT TOP 6 单据编号, 检验项目, 标准要求, 检验方法 FROM qc_mold_insp_detail"
                    + " WHERE ISNULL(检验方法,N'')<>N'' ORDER BY id DESC");

                p("\n=== ⑦ QC_ASM_INSP 是否有 合格数量/不合格数量 列(库存分流用) ===");
                q(c, "SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') ORDER BY c.column_id");
            }
        }
        System.out.println("WROTE " + out);
    }

    static void p(String s) throws Exception { w.write(s); w.write("\n"); }

    static void q(Connection c, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            p(h.toString());
            int rows = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    String s = v == null ? "" : String.valueOf(v).trim().replace("\n", "\\n");
                    if (s.length() > 80) s = s.substring(0, 80) + "…";
                    sb.append(s).append(i < n ? " | " : "");
                }
                p(sb.toString());
                rows++;
            }
            p("  (" + rows + " 行)");
        } catch (Exception e) {
            p("  ERR: " + e.getMessage());
        }
    }
}
