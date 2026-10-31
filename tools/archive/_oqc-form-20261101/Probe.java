import java.sql.*;
import java.util.*;

/** 只读探针:出厂检验报告 现状取证(2026-11-01)。 */
public class Probe {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            p("=== yj_panel(QC_OQC_REPORT / SALE_OUT) ===");
            q(c, "SELECT panel_code, panel_name, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col, module_group, config FROM yj_panel WHERE panel_code IN (N'QC_OQC_REPORT', N'SALE_OUT')");
            p("\n=== yj_button(SALE_OUT / QC_OQC_REPORT) ===");
            try { q(c, "SELECT panel_code, button_name, seq, * FROM yj_button WHERE panel_code IN (N'SALE_OUT', N'QC_OQC_REPORT') ORDER BY panel_code, seq"); }
            catch (Exception e) { p("yj_button 查询失败: " + e.getMessage()); }
            p("\n=== yj_button 全部列 ===");
            q(c, "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'yj_button' ORDER BY ORDINAL_POSITION");
            p("\n=== yj_field(QC_OQC_REPORT) ===");
            q(c, "SELECT id, place, seq, label, data_type, visible, hidden, editable, required, tab_key, col_group FROM yj_field WHERE panel_code = N'QC_OQC_REPORT' ORDER BY place, seq, id");
            p("\n=== yj_report_template ===");
            try { q(c, "SELECT id, template_code, panel_code, name, enabled, LEN(jrxml_text) AS len, update_at FROM yj_report_template ORDER BY id"); }
            catch (Exception e) { p("yj_report_template: " + e.getMessage()); }
            p("\n=== v_oqc_std 产品统计 ===");
            q(c, "SELECT 产品编号, COUNT(*) AS n FROM v_oqc_std GROUP BY 产品编号 ORDER BY 产品编号");
            p("\n=== v_oqc_std 行样例(B-92-25) ===");
            q(c, "SELECT TOP 20 计划单号, 序号, 检验项目, 检验要求, 检验方法, 检查频率, 检验类别 FROM v_oqc_std WHERE 产品编号 = N'B-92-25' ORDER BY 序号");
            p("\n=== v_oqc_std 行样例(C-23-11) ===");
            q(c, "SELECT TOP 20 计划单号, 序号, 检验项目, 检验要求, 检验方法, 检查频率, 检验类别 FROM v_oqc_std WHERE 产品编号 = N'C-23-11' ORDER BY 序号");
            p("\n=== qc_oqc_head / detail 行数 ===");
            try {
                q(c, "SELECT COUNT(*) AS heads FROM qc_oqc_head");
                q(c, "SELECT COUNT(*) AS details FROM qc_oqc_detail");
                q(c, "SELECT TOP 5 单据编号, 客户名称, 产品编码, 产品名称, 规格型号, 生产日期, 生产数量, 检测日期, AQL, 检验结论, 备注, 出库单号 FROM qc_oqc_head ORDER BY id DESC");
                q(c, "SELECT TOP 12 单据编号, 行号, 序号, 检验项目, 检验要求, 抽样标准, 抽检量, 实测值1, 结果, 判定, 数据来源 FROM qc_oqc_detail ORDER BY id");
            } catch (Exception e) { p("qc_oqc_* : " + e.getMessage()); }
            p("\n=== bl_sale_out 近期单据 ===");
            q(c, "SELECT TOP 8 h.单据编号, h.单据日期, h.客户, COUNT(l.id) AS 行数 FROM bd_sale_out h LEFT JOIN bl_sale_out l ON l.单据编号 = h.单据编号 GROUP BY h.单据编号, h.单据日期, h.客户 ORDER BY h.单据编号 DESC");
            p("\n=== yj_role_panel(QC_OQC_REPORT) ===");
            q(c, "SELECT role_id, panel_code, perms FROM yj_role_panel WHERE panel_code = N'QC_OQC_REPORT'");
        }
    }

    static void q(Connection c, String sql) {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            List<String> head = new ArrayList<>();
            for (int i = 1; i <= n; i++) head.add(m.getColumnLabel(i));
            p(String.join(" | ", head));
            int rows = 0;
            while (rs.next() && rows < 60) {
                List<String> vals = new ArrayList<>();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    String sv = v == null ? "NULL" : String.valueOf(v);
                    if (sv.length() > 160) sv = sv.substring(0, 160) + "…";
                    vals.add(sv.replace("\n", "\\n").replace("\t", "\\t"));
                }
                p(String.join(" | ", vals));
                rows++;
            }
            p("(" + rows + " rows)");
        } catch (Exception e) {
            p("[ERR] " + e.getMessage());
        }
    }

    static void p(String s) { System.out.println(s); }
}
