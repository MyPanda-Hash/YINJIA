package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 核实:图4的「出货检验项目控制计划」是否=系统 RD_INSP_PLAN;其明细列与下拉取值。 */
public class PlanProbe {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\probe-plan.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("=== ① rd_insp_plan_head 行数 + 是否有 YJ-RD001 ===");
                q(c, "SELECT COUNT(*) AS 头表行数 FROM rd_insp_plan_head");
                q(c, "SELECT 单据编号, 文档编号, 标题, 版本号, 产品编号, 客户项目名称, 编写人, 审核人, 表单管理人"
                    + " FROM rd_insp_plan_head");

                p("\n=== ② rd_insp_plan_detail 行数 ===");
                q(c, "SELECT COUNT(*) AS 行表行数 FROM rd_insp_plan_detail");

                p("\n=== ③ rd_insp_plan_detail 物理列 ===");
                q(c, "SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.rd_insp_plan_detail') ORDER BY c.column_id");

                p("\n=== ④ RD_INSP_PLAN 明细字段的「下拉框」字典 SQL(检验类别/检测频率) ===");
                q(c, "SELECT label, data_type, dict_sql FROM yj_field"
                    + " WHERE panel_code='RD_INSP_PLAN' AND place='detail' ORDER BY seq");

                p("\n=== ⑤ 系统里是否有『出货检验』字样的面板 ===");
                q(c, "SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel"
                    + " WHERE panel_name LIKE N'%出货%' OR panel_name LIKE N'%控制计划%'");

                p("\n=== ⑥ 三张工序检验单的「工序」取值(与制程检验表的关系) ===");
                q(c, "SELECT 工序, COUNT(*) AS n FROM qc_mold_insp_head GROUP BY 工序"
                    + " UNION ALL SELECT 工序, COUNT(*) FROM qc_cut_insp_head GROUP BY 工序"
                    + " UNION ALL SELECT 工序, COUNT(*) FROM qc_asm_insp_head GROUP BY 工序");

                p("\n=== ⑦ bs_inv 里 C-84-02 / C-84-01 是否存在(截图里的产品编码) ===");
                q(c, "SELECT 存货编码, 存货名称, 规格型号, 所属类别 FROM bs_inv"
                    + " WHERE 存货编码 IN ('C-84-02','C-84-01')");

                p("\n=== ⑧ 产品编号 参照指向(RD_INSP_PLAN.产品编号) ===");
                q(c, "SELECT label, ref_panel, ref_field, display_field FROM yj_field"
                    + " WHERE panel_code='RD_INSP_PLAN' AND label='产品编号'");
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
                    if (s.length() > 110) s = s.substring(0, 110) + "…";
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
