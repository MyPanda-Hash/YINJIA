package com.yinjia.mes.tools;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 核实 QC_ITEM.检验内容 是否可作分组用,以及 QC_PLAN 的字典配置。 */
public class ItemProbe {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(url,
                System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {
            sb.append("=== ① QC_ITEM.检验内容 的取值分布(天然的类别/分组) ===\n");
            q(c, sb, "SELECT 检验内容, COUNT(*) AS 项目数 FROM bs_qc_item"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验内容 ORDER BY 检验内容");

            sb.append("\n=== ② QC_ITEM.检验内容 的字段配置(是否下拉/有无字典) ===\n");
            q(c, sb, "SELECT label,data_type,ISNULL(dict_sql,'') AS dict FROM yj_field"
                + " WHERE panel_code='QC_ITEM' AND col_name='检验内容'");

            sb.append("\n=== ③ QC_ITEM 面板的取数配置 ===\n");
            q(c, sb, "SELECT panel_code,panel_name,mode,line_table,head_table,group_col,pk_col,code_col"
                + " FROM yj_panel WHERE panel_code IN ('QC_ITEM','QC_PLAN')");

            sb.append("\n=== ④ 现有方案 QC_PLAN ===\n");
            q(c, sb, "SELECT 方案编码,方案名称,适用存货,适用存货类别,检验方式,文件编码 FROM bs_qc_plan"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y'");

            sb.append("\n=== ⑤ QC_ITEM 是否支持「参照」回填到检验单(看有无 ref) ===\n");
            q(c, sb, "SELECT panel_code,label,ref_panel,ref_field,display_field FROM yj_field"
                + " WHERE panel_code='QC_PROC_INSP' AND ref_panel IS NOT NULL AND ref_panel<>''");
        }
        Files.write(Paths.get("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\item.txt"),
                sb.toString().getBytes(StandardCharsets.UTF_8));
        System.out.println("WROTE");
    }

    static void q(Connection c, StringBuilder sb, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            sb.append(h).append("\n");
            while (rs.next()) {
                StringBuilder r = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    String s = v == null ? "" : String.valueOf(v).trim();
                    if (s.length() > 70) s = s.substring(0, 70) + "…";
                    r.append(s).append(i < n ? " | " : "");
                }
                sb.append(r).append("\n");
            }
        } catch (Exception e) {
            sb.append("  ERR: ").append(e.getMessage()).append("\n");
        }
    }
}
