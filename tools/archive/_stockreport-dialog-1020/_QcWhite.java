import java.sql.*;

/**
 * 查 migrate-qc-insp-clear-11-docstatus-20261018.sql 的白名单在测试库里缺哪张单
 * (2026-10-20 测试库同步报「白名单里有 1 张单据在 qc_insp 中不存在」)。
 *
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QcWhite.java
 */
public class _QcWhite {
    public static void main(String[] a) throws Exception {
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String[] white = {"IJ-2026-09-0152", "IJ-2026-10-0011", "IJ-2026-10-0012", "IJ-2026-10-0013",
                "IJ-2026-10-0014", "IJ-2026-10-0015", "IJ-2026-10-0016", "IJ-2026-10-0017",
                "IJ-2026-10-0018", "IJ-2026-10-0019", "IJ-2026-10-0020"};
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            System.out.println("=== " + db + " ===");
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                            + ";encrypt=false;trustServerCertificate=true")) {
                int missing = 0;
                for (String no : white) {
                    try (PreparedStatement ps = c.prepareStatement(
                            "SELECT 单据状态 FROM qc_insp WHERE 单据编号 = ?")) {
                        ps.setString(1, no);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (!rs.next()) { System.out.println("  缺失: " + no); missing++; }
                        }
                    }
                }
                System.out.println("  白名单 11 张 | 缺失 " + missing + " 张");
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code=N'QC_INSP' AND doc_no IN "
                                + "('IJ-2026-09-0152','IJ-2026-10-0011','IJ-2026-10-0012','IJ-2026-10-0013','IJ-2026-10-0014',"
                                + "'IJ-2026-10-0015','IJ-2026-10-0016','IJ-2026-10-0017','IJ-2026-10-0018','IJ-2026-10-0019','IJ-2026-10-0020')")) {
                    rs.next();
                    System.out.println("  yj_doc_status 里这 11 单的残留行数 = " + rs.getInt(1));
                }
            } catch (Exception e) {
                System.out.println("  ERR " + e.getMessage());
            }
        }
    }
}
