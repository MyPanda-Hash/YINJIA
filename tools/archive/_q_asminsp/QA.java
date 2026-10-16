import java.sql.*;

/** 一次性探针:对照截图「出货检验功能性测试组」表头,核对成品检验单(QC_ASM_INSP)字段是否齐备。 */
public class QA {
    static final String[] WANT = {
        "客户名称", "产品编码", "规格型号", "批次号", "检验员", "产线常规功能性结果", "结果判断", "总结论",
        "检验要求", "检验方法", "检查频率", "实测数值", "测量值1", "测量值5", "判定", "单项判定", "表区"
    };

    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                System.out.println("########## " + db + " ##########");
                q(c, "QC_ASM_INSP 全部字段(按 place/seq)",
                    "SELECT place, seq, col_name, data_type, editable, visible, hidden FROM yj_field WHERE panel_code=N'QC_ASM_INSP' ORDER BY place, seq");
                q(c, "截图七列在 QC_ASM_INSP / QC_PROC_INSP 上是否登记",
                    "SELECT w.w AS 截图列, "
                  + " MAX(CASE WHEN f.panel_code=N'QC_ASM_INSP' THEN N'有' ELSE N'—' END) AS 成品检验单, "
                  + " MAX(CASE WHEN f.panel_code=N'QC_PROC_INSP' THEN N'有' ELSE N'—' END) AS 制程检验单 "
                  + "FROM (VALUES (N'客户名称'),(N'产品编码'),(N'规格型号'),(N'批次号'),(N'检验员'),(N'产线常规功能性结果'),(N'结果判断'),(N'总结论')) AS w(w) "
                  + "LEFT JOIN yj_field f ON f.col_name = w.w AND f.panel_code IN (N'QC_ASM_INSP', N'QC_PROC_INSP') GROUP BY w.w");
                q(c, "截图里「型号(mm)」「批号」「检验人员」的近似字段",
                    "SELECT panel_code, col_name, place FROM yj_field WHERE col_name IN (N'规格型号', N'型号', N'批次号', N'批号', N'检验员', N'检验人员') AND panel_code IN (N'QC_ASM_INSP', N'QC_PROC_INSP') ORDER BY panel_code, col_name");
                q(c, "成品检验单里「表区」现有取值(看有没有 功能性测试 区)",
                    "SELECT ISNULL(表区,N'(null)') AS 表区, COUNT(*) AS 行数 FROM qc_asm_insp_detail GROUP BY 表区 ORDER BY 表区");
                q(c, "产线常规功能性结果/客户名称 全库哪个面板有",
                    "SELECT w.w AS 字段, ISNULL(STUFF((SELECT N',' + f.panel_code FROM yj_field f WHERE f.col_name = w.w ORDER BY f.panel_code FOR XML PATH('')), 1, 1, N''), N'(无任何面板)') AS 出现在 "
                  + "FROM (VALUES (N'客户名称'),(N'产线常规功能性结果'),(N'结果判断'),(N'总结论'),(N'检验人员')) AS w(w)");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            while (rs.next()) {
                for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
