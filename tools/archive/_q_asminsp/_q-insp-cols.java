import java.sql.*;

/** 一次性探针:三类工序检验单(组装成品/成型/切炭)的字段与物理列现状,对着「取出货检验计划」做需求盘点。 */
public class QQ {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "yj_field for inspection panels",
                "SELECT f.panel_code, f.col_name, f.label, f.place, f.seq, f.editable, f.visible, f.hidden "
                    + "FROM yj_field f WHERE f.panel_code IN ('QC_ASM_INSP','QC_MOLD_INSP','QC_CUT_INSP','QC_PROC_INSP') "
                    + "ORDER BY f.panel_code, f.place, f.seq");
            q(c, "physical cols: qc_asm_insp_head",
                "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_asm_insp_head') ORDER BY column_id");
            q(c, "physical cols: qc_asm_insp_detail",
                "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.qc_asm_insp_detail') ORDER BY column_id");
            q(c, "panel rows",
                "SELECT panel_code, panel_name, category, mode, line_table, head_table, prefix, module_group FROM yj_panel WHERE panel_code IN ('QC_ASM_INSP','QC_PROC_INSP')");
            q(c, "rows in rd_insp_plan_head/detail",
                "SELECT (SELECT COUNT(*) FROM rd_insp_plan_head) AS planHead, "
                    + "(SELECT COUNT(*) FROM rd_insp_plan_detail) AS planDetail, "
                    + "(SELECT COUNT(*) FROM rd_insp_plan_head WHERE ISNULL(asp_cancel,'N')<>'Y') AS aliveHead");
            q(c, "plan head sample",
                "SELECT TOP 5 [单据编号], [产品编号], [标题], [版本号], [客户项目名称], [产品整体尺寸] FROM rd_insp_plan_head");
            q(c, "plan detail cols",
                "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.rd_insp_plan_detail') ORDER BY column_id");
            q(c, "plan detail sample",
                "SELECT TOP 12 [单据编号], [序号], [控制项目], [控制标准及要求], [控制方法], [检测频率], [检测仪器], [不合格应对措施], [检验内容], [质量控制内容] FROM rd_insp_plan_detail");
            q(c, "asm insp head rows",
                "SELECT TOP 5 [单据编号], [产品编码], [产品名称], [检验方案], [文件编码], [执行标准] FROM qc_asm_insp_head");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            int rows = 0;
            while (rs.next()) {
                rows++;
                for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
            System.out.println("(" + rows + " rows)");
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
