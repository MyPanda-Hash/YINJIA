package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 导出 QC_PROC_INSP 的字段 label(供写 jrxml 时对齐 $F{}/$P{} 名称)。 */
public class LabelDump {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\labels.txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {
                p("### 明细字段(模板 <field name=...> 用)");
                q(c, "SELECT seq, label, data_type FROM yj_field WHERE panel_code='QC_PROC_INSP'"
                    + " AND place LIKE '%detail%' AND place NOT LIKE '%header%' ORDER BY seq");
                p("\n### 头字段(模板 <parameter name=...> 用)");
                q(c, "SELECT seq, label, data_type FROM yj_field WHERE panel_code='QC_PROC_INSP'"
                    + " AND place LIKE '%header%' ORDER BY seq");
                p("\n### 面板元数据");
                q(c, "SELECT panel_code, panel_name, mode, head_table, line_table, group_col, pk_col, code_col, date_col, detail_key"
                    + " FROM yj_panel WHERE panel_code='QC_PROC_INSP'");
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
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    sb.append(v == null ? "" : String.valueOf(v).trim()).append(i < n ? " | " : "");
                }
                p(sb.toString());
            }
        } catch (Exception e) {
            p("  ERR: " + e.getMessage());
        }
    }
}
