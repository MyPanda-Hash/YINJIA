package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 补查:检验单明细数据样例 + 检验方案参照指向 + 报工与检验单的对应。 */
public class QcProbe3 {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\probe3.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("=== ① 成型检验单明细样例(按单据编号) ===");
                q(c, "SELECT TOP 40 单据编号, 表区, 行号, 检验项目, 标准要求, 实测数值, 检验方法, 判定, 数量"
                    + " FROM qc_mold_insp_detail ORDER BY id DESC");

                p("\n=== ② 组装检验单明细样例 ===");
                q(c, "SELECT TOP 20 单据编号, 表区, 行号, 检验项目, 标准要求, 实测数值, 检验方法, 判定"
                    + " FROM qc_asm_insp_detail ORDER BY id DESC");

                p("\n=== ③ 切炭检验单明细样例 ===");
                q(c, "SELECT TOP 20 单据编号, 表区, 行号, 检验项目, 标准要求, 实测数值, 检验方法, 判定"
                    + " FROM qc_cut_insp_detail ORDER BY id DESC");

                p("\n=== ④ 「检验方案」参照指向(ref_panel/ref_field) ===");
                q(c, "SELECT panel_code, label, ref_panel, ref_field, display_field FROM yj_field"
                    + " WHERE label='检验方案' AND panel_code LIKE 'QC_%'");

                p("\n=== ⑤ 报工单(WORK_REPORT/scjl)里已有的检验相关列 ===");
                q(c, "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.scjl')"
                    + " AND (name LIKE N'%检%' OR name LIKE N'%jc%' OR name LIKE N'%wg%') ORDER BY column_id");

                p("\n=== ⑥ 报工单数据样例(工单/工序/批次) ===");
                q(c, "SELECT TOP 15 报工单号, gldh AS 工单号, 工单行号, gxdm AS 工序, sl AS 数量,"
                    + " 批次号, wgzt AS 完工状态, jc_no AS 检验单号 FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC");

                p("\n=== ⑦ QC 面板在菜单里的位置 ===");
                q(c, "SELECT panel_code, panel_name, module_group FROM yj_panel"
                    + " WHERE panel_code LIKE 'QC_%' ORDER BY panel_code");

                p("\n=== ⑧ 是否有「检验方案/检验标准」类的标准库面板 ===");
                q(c, "SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel"
                    + " WHERE panel_name LIKE N'%检验%' OR panel_name LIKE N'%品质%' OR panel_name LIKE N'%规范%' ORDER BY panel_code");
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
                    if (s.length() > 90) s = s.substring(0, 90) + "…";
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
