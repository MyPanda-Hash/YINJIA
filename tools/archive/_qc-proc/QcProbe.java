package com.yinjia.mes.tools;

import java.sql.*;

/** 查工序检验相关面板/字段/表结构,为制程检验单方案提供事实依据。 */
public class QcProbe {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String user = System.getenv("YINJIA_SQL_USER");
        String pass = System.getenv("YINJIA_SQL_PASS");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {

            System.out.println("=== ① 相关面板 ===");
            q(c, "SELECT panel_code, panel_name, mode, head_table, line_table, module_group"
                + " FROM yj_panel WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP','QC_FIN_SPEC','RD_INSP_PLAN','RD_MOLD_PROC','WO_REPORT')");

            System.out.println("=== ② 三张工序检验单的表头字段 ===");
            q(c, "SELECT panel_code, place, seq, label, col_name, data_type"
                + " FROM yj_field WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP') AND place LIKE '%header%'"
                + " ORDER BY panel_code, seq");

            System.out.println("=== ③ 三张工序检验单的明细字段 ===");
            q(c, "SELECT panel_code, seq, label, col_name, data_type"
                + " FROM yj_field WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP') AND place LIKE '%detail%'"
                + " ORDER BY panel_code, seq");

            System.out.println("=== ④ 单据量 ===");
            q(c, "SELECT 'QC_MOLD_INSP' AS p, COUNT(*) AS n FROM qc_mold_insp_head"
                + " UNION ALL SELECT 'QC_CUT_INSP', COUNT(*) FROM qc_cut_insp_head"
                + " UNION ALL SELECT 'QC_ASM_INSP', COUNT(*) FROM qc_asm_insp_head"
                + " UNION ALL SELECT 'RD_INSP_PLAN', COUNT(*) FROM rd_insp_plan_head"
                + " UNION ALL SELECT 'RD_MOLD_PROC', COUNT(*) FROM rd_mold_proc_head"
                + " UNION ALL SELECT 'WO_REPORT(scjl)', COUNT(*) FROM scjl");

            System.out.println("=== ⑤ 出货检验计划表(RD_INSP_PLAN)结构 ===");
            q(c, "SELECT seq, place, label, col_name, data_type FROM yj_field"
                + " WHERE panel_code='RD_INSP_PLAN' ORDER BY place, seq");

            System.out.println("=== ⑥ 成型工艺清单(RD_MOLD_PROC)结构 ===");
            q(c, "SELECT seq, place, label, col_name, data_type FROM yj_field"
                + " WHERE panel_code='RD_MOLD_PROC' ORDER BY place, seq");
        }
    }

    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println("  " + h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    sb.append(v == null ? "" : String.valueOf(v).trim()).append(i < n ? " | " : "");
                }
                System.out.println("  " + sb);
                rows++;
            }
            System.out.println("  (" + rows + " 行)");
        } catch (Exception e) {
            System.out.println("  ERR: " + e.getMessage());
        }
    }
}
