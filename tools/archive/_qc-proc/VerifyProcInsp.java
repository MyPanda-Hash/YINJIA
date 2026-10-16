package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/** 验证新建的制程检验单面板:表/面板/字段/译名/授权。 */
public class VerifyProcInsp {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\verify-" + db + ".txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            p("### 账套 " + db);
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("\n① 表存在性 + 列数 + 中文注明");
                q(c, "SELECT t.name AS 表名, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id=t.object_id) AS 列数,"
                    + " ISNULL(CAST(ep.value AS nvarchar(200)),N'(无注明)') AS 中文注明"
                    + " FROM sys.tables t LEFT JOIN sys.extended_properties ep"
                    + "   ON ep.major_id=t.object_id AND ep.minor_id=0 AND ep.class=1 AND ep.name='MS_Description'"
                    + " WHERE t.name IN ('qc_proc_insp_head','qc_proc_insp_detail') ORDER BY t.name");

                p("\n② 面板登记");
                q(c, "SELECT panel_code, panel_name, mode, head_table, line_table, prefix, date_col, module_group"
                    + " FROM yj_panel WHERE panel_code='QC_PROC_INSP'");

                p("\n③ 字段数(头/明细)");
                q(c, "SELECT CASE WHEN place LIKE '%header%' THEN 'header' ELSE 'detail' END AS 区, COUNT(*) AS 字段数"
                    + " FROM yj_field WHERE panel_code='QC_PROC_INSP' GROUP BY CASE WHEN place LIKE '%header%' THEN 'header' ELSE 'detail' END");

                p("\n④ 头字段清单");
                q(c, "SELECT seq, label, col_name, data_type, place FROM yj_field"
                    + " WHERE panel_code='QC_PROC_INSP' AND place LIKE '%header%' ORDER BY seq");

                p("\n⑤ 明细字段清单");
                q(c, "SELECT seq, label, col_name, data_type, place FROM yj_field"
                    + " WHERE panel_code='QC_PROC_INSP' AND place LIKE '%detail%' ORDER BY seq");

                p("\n⑥ 译名");
                q(c, "SELECT scope, ref_key, locale, text FROM yj_translation"
                    + " WHERE (scope='panel' AND ref_key='制程检验单')"
                    + "    OR (scope='field' AND ref_key IN ('表区','检验要求','单项判定','抽检总量','结果判断','检验时间','检验类别'))"
                    + " ORDER BY scope, ref_key");

                p("\n⑦ 角色授权行数");
                q(c, "SELECT COUNT(*) AS 授权行数 FROM yj_role_panel WHERE panel_code='QC_PROC_INSP'");

                p("\n⑧ 单据数(应为 0)");
                q(c, "SELECT (SELECT COUNT(*) FROM qc_proc_insp_head) AS 头表, (SELECT COUNT(*) FROM qc_proc_insp_detail) AS 行表");
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
