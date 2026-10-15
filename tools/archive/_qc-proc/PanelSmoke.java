package com.yinjia.mes.tools;

import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.*;

/**
 * 面板可用性冒烟:模拟引擎取数(引擎统一拼 SELECT t.<pk_col> … WHERE ISNULL(t.asp_cancel,'N')<>'Y'),
 * 确认新面板 QC_PROC_INSP 打开不会 500(体检 13 项口径)。
 */
public class PanelSmoke {
    static BufferedWriter w;

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        String out = "D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\smoke-" + db + ".txt";
        try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(out), StandardCharsets.UTF_8)) {
            w = bw;
            p("### 面板冒烟 " + db);
            try (Connection c = DriverManager.getConnection(url,
                    System.getenv("YINJIA_SQL_USER"), System.getenv("YINJIA_SQL_PASS"))) {

                p("\n① 引擎口径取数(头表,应与面板列表页同 SQL 形状)");
                q(c, "SELECT TOP 5 t.[单据编号], t.[单据日期], t.[检验类别], t.[客户名称], t.[总结论]"
                    + " FROM qc_proc_insp_head t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC");

                p("\n② 引擎口径取数(行表)");
                q(c, "SELECT TOP 5 t.[单据编号], t.[表区], t.[检验项目], t.[检验要求], t.[实测数值], t.[单项判定]"
                    + " FROM qc_proc_insp_detail t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.id DESC");

                p("\n③ 逐字段校验:yj_field 登记的每一列在物理表上都必须存在(否则面板打开 500)");
                q(c, "SELECT f.panel_code, f.place, f.label, f.col_name,"
                    + " CASE WHEN c.name IS NULL THEN N'❌缺列' ELSE N'✓' END AS 物理列"
                    + " FROM yj_field f"
                    + " LEFT JOIN sys.columns c ON c.object_id = CASE WHEN f.place LIKE '%detail%' AND f.place NOT LIKE '%header%'"
                    + "        THEN OBJECT_ID(N'dbo.qc_proc_insp_detail') ELSE OBJECT_ID(N'dbo.qc_proc_insp_head') END"
                    + "   AND c.name = f.col_name"
                    + " WHERE f.panel_code = N'QC_PROC_INSP' AND c.name IS NULL");

                p("\n④ 明细列是否都存在于行表(单独再查一次,防③的 CASE 判断偏差)");
                q(c, "SELECT f.col_name AS 登记列, CASE WHEN c.name IS NULL THEN N'❌行表无此列' ELSE N'✓' END AS 行表"
                    + " FROM yj_field f LEFT JOIN sys.columns c"
                    + "   ON c.object_id = OBJECT_ID(N'dbo.qc_proc_insp_detail') AND c.name = f.col_name"
                    + " WHERE f.panel_code = N'QC_PROC_INSP' AND f.place LIKE N'%detail%' ORDER BY f.seq");

                p("\n⑤ 头列是否都存在于头表");
                q(c, "SELECT f.col_name AS 登记列, CASE WHEN c.name IS NULL THEN N'❌头表无此列' ELSE N'✓' END AS 头表"
                    + " FROM yj_field f LEFT JOIN sys.columns c"
                    + "   ON c.object_id = OBJECT_ID(N'dbo.qc_proc_insp_head') AND c.name = f.col_name"
                    + " WHERE f.panel_code = N'QC_PROC_INSP' AND f.place LIKE N'%header%' ORDER BY f.seq");

                p("\n⑥ 号池:前缀 ZC 是否已登记(生单取号用)");
                q(c, "SELECT TOP 5 * FROM s_allno WHERE no LIKE N'ZC%'");
                q(c, "SELECT COUNT(*) AS s_allno总数 FROM s_allno");
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
                    String s = v == null ? "" : String.valueOf(v).trim();
                    if (s.length() > 60) s = s.substring(0, 60) + "…";
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
