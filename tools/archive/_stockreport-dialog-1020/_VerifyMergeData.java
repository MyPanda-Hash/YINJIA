import java.sql.*;

/**
 * 复核远端 57 提交带来的数据迁移是否真的落地(2026-10-20 启动后自检)。
 *  · 90 张演示检验单:asp_user2='qc-realize-20261018' 是否 =90 且都已审核 + yj_doc_status 归档
 *  · 11 张真实单:yj_doc_status 残留是否已清(应为 0)
 *  · qc_insp_detail 是否已补 4 列
 *
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_VerifyMergeData.java
 */
public class _VerifyMergeData {
    public static void main(String[] a) throws Exception {
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            System.out.println("=== " + db + " ===");
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                            + ";encrypt=false;trustServerCertificate=true")) {
                one(c, "演示检验单已完善(应 90)", "SELECT COUNT(*) FROM qc_insp WHERE ISNULL(asp_user2,'')='qc-realize-20261018'");
                one(c, "  其中已审核(应 90)", "SELECT COUNT(*) FROM qc_insp WHERE ISNULL(asp_user2,'')='qc-realize-20261018' AND 单据状态=N'已审核'");
                one(c, "  其明细行数", "SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号 LIKE N'IJ-2026-10-%'");
                one(c, "  归档状态行(archived=Y)", "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'QC_INSP' AND archived='Y'");
                one(c, "  审批留痕条数", "SELECT COUNT(*) FROM yj_form_approval WHERE panel_code=N'QC_INSP' AND action=N'AUDIT'");
                one(c, "11 张真实单残留审核状态(应 0)", "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'QC_INSP' AND doc_no IN "
                        + "('IJ-2026-09-0152','IJ-2026-10-0011','IJ-2026-10-0012','IJ-2026-10-0013','IJ-2026-10-0014',"
                        + "'IJ-2026-10-0015','IJ-2026-10-0016','IJ-2026-10-0017','IJ-2026-10-0018','IJ-2026-10-0019','IJ-2026-10-0020')");
                one(c, "qc_insp_detail 列数(应 63)", "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail'");
            } catch (Exception e) {
                System.out.println("  ERR " + e.getMessage());
            }
        }
    }

    static void one(Connection c, String label, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            System.out.println("  " + label + " = " + rs.getInt(1));
        }
    }
}
