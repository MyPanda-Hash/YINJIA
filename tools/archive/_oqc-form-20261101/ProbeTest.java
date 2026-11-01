import java.sql.*;
import java.util.*;

/** 只读探针:测试账套 HSDZ_MES_TEST 里出厂检验报告 E2E 所需数据。 */
public class ProbeTest {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10";

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            p("=== 对象是否存在 ===");
            q(c, "SELECT name, type FROM sys.objects WHERE name IN ('qc_oqc_head','qc_oqc_detail','qc_oqc_item_map','v_oqc_std')");
            p("\n=== v_oqc_std 产品统计 ===");
            q(c, "SELECT 产品编号, COUNT(*) n FROM v_oqc_std GROUP BY 产品编号 ORDER BY 产品编号");
            p("\n=== 含 B-92-25 / C-23-11 的销售出库单(近 10) ===");
            q(c, "SELECT TOP 10 l.单据编号, h.客户, l.存货编码, l.存货名称, l.数量, ISNULL(l.批号,'') 批号, l.id lineId FROM bl_sale_out l JOIN bd_sale_out h ON h.单据编号=l.单据编号 WHERE l.存货编码 IN (N'B-92-25', N'C-23-11') AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.单据编号 DESC");
            p("\n=== 最近 10 张销售出库单 ===");
            q(c, "SELECT TOP 10 l.单据编号, h.客户, l.存货编码, l.存货名称, l.数量, l.id lineId FROM bl_sale_out l JOIN bd_sale_out h ON h.单据编号=l.单据编号 WHERE ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.单据编号 DESC, l.id");
            p("\n=== 成品检验单(B-92-25 / C-23-11) ===");
            q(c, "SELECT 单据编号, REPLACE(REPLACE(产品编码,CHAR(9),''),' ','') 产品编码, 工单号, 工单行号, 批次号 FROM qc_asm_insp_head WHERE REPLACE(REPLACE(REPLACE(ISNULL(产品编码,''),CHAR(9),''),CHAR(10),''),' ','') IN (N'B-92-25',N'C-23-11') ORDER BY 单据日期 DESC");
            p("\n=== qc_oqc_head / detail 现有行 ===");
            q(c, "SELECT COUNT(*) heads FROM qc_oqc_head");
            q(c, "SELECT COUNT(*) details FROM qc_oqc_detail");
            p("\n=== yj_report_template ===");
            q(c, "SELECT template_code, panel_code, name, enabled FROM yj_report_template ORDER BY id");
            p("\n=== yj_panel QC_OQC_REPORT ===");
            q(c, "SELECT panel_code, panel_name, mode, prefix FROM yj_panel WHERE panel_code = N'QC_OQC_REPORT'");
            p("\n=== 测试账套用户 admin 是否存在 ===");
            q(c, "SELECT username, real_name, is_admin FROM yj_user WHERE username = 'admin'");
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
            while (rs.next() && rows < 40) {
                List<String> vals = new ArrayList<>();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    String sv = v == null ? "NULL" : String.valueOf(v);
                    if (sv.length() > 120) sv = sv.substring(0, 120) + "…";
                    vals.add(sv.replace("\n", "\\n").replace("\t", "\\t"));
                }
                p(String.join(" | ", vals));
                rows++;
            }
            p("(" + rows + " rows)");
        } catch (Exception e) { p("[ERR] " + e.getMessage()); }
    }

    static void p(String s) { System.out.println(s); }
}
