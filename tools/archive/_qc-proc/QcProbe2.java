package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 查工序检验结构,直接以 UTF-8 写文件(绕开控制台编码)。 */
public class QcProbe2 {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String user = System.getenv("YINJIA_SQL_USER");
        String pass = System.getenv("YINJIA_SQL_PASS");
        String out = args.length > 0 ? args[0] : "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\probe2.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url, user, pass)) {
                p("=== ① 工序检验单表头字段(中文) ===");
                q(c, "SELECT panel_code, seq, label, col_name, data_type FROM yj_field"
                    + " WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP')"
                    + " AND place LIKE '%header%' ORDER BY panel_code, seq");

                p("\n=== ② 工序检验单明细字段(中文) ===");
                q(c, "SELECT panel_code, seq, label, col_name, data_type FROM yj_field"
                    + " WHERE panel_code IN ('QC_MOLD_INSP','QC_CUT_INSP','QC_ASM_INSP')"
                    + " AND place LIKE '%detail%' ORDER BY panel_code, seq");

                p("\n=== ③ 三张单的实际单据(头) ===");
                q(c, "SELECT '成型检验单' AS 单据, 单据编号, 工单号, 产品编码, 产品名称, 检验员, 单据日期"
                    + " FROM qc_mold_insp_head ORDER BY id DESC");

                p("\n=== ④ 成型检验单明细样例(最新一张) ===");
                q(c, "SELECT TOP 30 单据编号, 序号, 检验项目, 标准要求, 实测数值, 检验方法, 判定"
                    + " FROM qc_mold_insp_detail ORDER BY id DESC");

                p("\n=== ⑤ 出货检验计划表字段(中文) ===");
                q(c, "SELECT seq, place, label, col_name, data_type FROM yj_field"
                    + " WHERE panel_code='RD_INSP_PLAN' ORDER BY place, seq");

                p("\n=== ⑥ 成型工艺清单字段(中文) ===");
                q(c, "SELECT seq, place, label, col_name, data_type FROM yj_field"
                    + " WHERE panel_code='RD_MOLD_PROC' ORDER BY place, seq");

                p("\n=== ⑦ 报工单(scjl)关键列 ===");
                q(c, "SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.scjl') ORDER BY c.column_id");

                p("\n=== ⑧ 报工→检验单 的生成关系(form_flow_link) ===");
                q(c, "SELECT source_panel_code, target_panel_code, COUNT(*) AS 条数 FROM form_flow_link"
                    + " WHERE target_panel_code LIKE 'QC_%' GROUP BY source_panel_code, target_panel_code");
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
                    sb.append(v == null ? "" : String.valueOf(v).trim()).append(i < n ? " | " : "");
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
