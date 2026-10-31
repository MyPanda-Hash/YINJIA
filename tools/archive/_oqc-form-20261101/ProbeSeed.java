import java.sql.*;
import java.util.*;

/** 交叉库可用性 + E2E 造数素材核查。 */
public class ProbeSeed {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            p("=== 交叉库读(HDSZ_MES_TEST.dbo) ===");
            q(c, "SELECT COUNT(*) n FROM HSDZ_MES_TEST.dbo.yj_panel");
            q(c, "SELECT COUNT(*) n FROM HSDZ_MES_TEST.dbo.qc_oqc_head");
            p("\n=== 正式库:含 B-92-25 / C-23-11 的销售出库行 ===");
            q(c, "SELECT TOP 10 l.单据编号, h.客户, l.存货编码, l.存货名称, l.数量, ISNULL(l.批号,'') 批号, l.id lineId FROM bl_sale_out l JOIN bd_sale_out h ON h.单据编号=l.单据编号 WHERE l.存货编码 IN (N'B-92-25', N'C-23-11') AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.单据编号 DESC");
            p("\n=== 正式库:任一有 v_oqc_std 产品的整张销售出库单(带全部行) ===");
            q(c, "SELECT TOP 12 h.单据编号, h.单据日期, h.客户, l.id lineId, l.存货编码, l.存货名称, l.数量, ISNULL(l.批号,'') 批号 FROM bd_sale_out h JOIN bl_sale_out l ON l.单据编号=h.单据编号 WHERE l.存货编码 IN (SELECT 产品编号 FROM v_oqc_std) GROUP BY h.单据编号, h.单据日期, h.客户, l.id, l.存货编码, l.存货名称, l.数量, l.批号 ORDER BY h.单据编号 DESC");
            p("\n=== 正式库:rd_insp_plan_head(2 个产品) ===");
            q(c, "SELECT 单据编号, 产品编号, 客户项目名称, 版本号, 备用1, 单据日期 FROM rd_insp_plan_head WHERE 产品编号 IN (N'B-92-25',N'C-23-11') ORDER BY 产品编号, 单据日期 DESC");
            p("\n=== 正式库:qc_asm_insp_head(B-92-25 / C-23-11) ===");
            q(c, "SELECT 单据编号, REPLACE(REPLACE(ISNULL(产品编码,''),CHAR(9),''),' ','') 产品编码, 工单号, 工单行号, 批次号, 单据日期 FROM qc_asm_insp_head WHERE REPLACE(REPLACE(REPLACE(ISNULL(产品编码,''),CHAR(9),''),CHAR(10),''),' ','') IN (N'B-92-25',N'C-23-11') ORDER BY 单据日期 DESC");
            p("\n=== 测试库:bd_sale_out / bl_sale_out 列结构(必填空) ===");
            q(c, "SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM HSDZ_MES_TEST.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('bd_sale_out','bl_sale_out') AND IS_NULLABLE='NO' ORDER BY TABLE_NAME, ORDINAL_POSITION");
            p("\n=== 正式库:bd_sale_out / bl_sale_out 列结构(必填空) ===");
            q(c, "SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('bd_sale_out','bl_sale_out') AND IS_NULLABLE='NO' ORDER BY TABLE_NAME, ORDINAL_POSITION");
        }
    }
    static void q(Connection c, String sql) {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData(); int n = m.getColumnCount();
            List<String> head = new ArrayList<>();
            for (int i = 1; i <= n; i++) head.add(m.getColumnLabel(i));
            p(String.join(" | ", head));
            int rows = 0;
            while (rs.next() && rows < 30) {
                List<String> vals = new ArrayList<>();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    String sv = v == null ? "NULL" : String.valueOf(v);
                    if (sv.length() > 100) sv = sv.substring(0, 100) + "…";
                    vals.add(sv);
                }
                p(String.join(" | ", vals)); rows++;
            }
            p("(" + rows + " rows)");
        } catch (Exception e) { p("[ERR] " + e.getMessage()); }
    }
    static void p(String s) { System.out.println(s); }
}
