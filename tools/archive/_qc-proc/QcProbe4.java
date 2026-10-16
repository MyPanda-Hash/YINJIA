package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 查检验方案/检验项目标准库 + 检验单生成钩子的落点。 */
public class QcProbe4 {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\probe4.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("=== ① bs_qc_plan(检验方案)结构 ===");
                q(c, "SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.bs_qc_plan') ORDER BY c.column_id");

                p("\n=== ② bs_qc_plan 数据 ===");
                q(c, "SELECT * FROM bs_qc_plan");

                p("\n=== ③ bs_qc_item(检验项目)结构 ===");
                q(c, "SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c"
                    + " JOIN sys.types t ON t.user_type_id=c.user_type_id"
                    + " WHERE c.object_id=OBJECT_ID('dbo.bs_qc_item') ORDER BY c.column_id");

                p("\n=== ④ bs_qc_item 数据(前 40) ===");
                q(c, "SELECT TOP 40 * FROM bs_qc_item ORDER BY id");

                p("\n=== ⑤ QC_PLAN / QC_ITEM 面板字段 ===");
                q(c, "SELECT panel_code, place, seq, label, col_name, data_type FROM yj_field"
                    + " WHERE panel_code IN ('QC_PLAN','QC_ITEM') ORDER BY panel_code, place, seq");

                p("\n=== ⑥ 检验单生成钩子涉及的工序映射(代码常量落库口径) ===");
                q(c, "SELECT DISTINCT gxdm AS 工序 FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' AND gxdm IS NOT NULL");

                p("\n=== ⑦ 三张检验单的头表列(看有无检验类别/首件标志) ===");
                q(c, "SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.qc_mold_insp_head') ORDER BY c.column_id");
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
                    if (s.length() > 100) s = s.substring(0, 100) + "…";
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
