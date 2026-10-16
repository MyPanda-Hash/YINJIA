import java.sql.*;

/** 只读核查:检验项目/方案的现有数据与结构(判断出厂检验报告能否关联到已有检验体系)。 */
public class Q {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            String[][] qs = {
                {"bs_qc_item", "SELECT COUNT(*) FROM bs_qc_item"},
                {"bs_qc_plan", "SELECT COUNT(*) FROM bs_qc_plan"},
                {"qc_insp_rec", "SELECT COUNT(*) FROM qc_insp_rec"},
                {"qc_insp_rec_detail", "SELECT COUNT(*) FROM qc_insp_rec_detail"},
                {"qc_catalog_detail", "SELECT COUNT(*) FROM qc_catalog_detail"},
                {"qc_asm_insp_detail", "SELECT COUNT(*) FROM qc_asm_insp_detail"},
                {"qc_mold_insp_detail", "SELECT COUNT(*) FROM qc_mold_insp_detail"},
                {"qc_cut_insp_detail", "SELECT COUNT(*) FROM qc_cut_insp_detail"},
            };
            for (String[] q : qs) {
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(q[1])) {
                    rs.next();
                    System.out.println("ROWS " + q[0] + " = " + rs.getInt(1));
                } catch (Exception e) {
                    System.out.println("ROWS " + q[0] + " ERR=" + e.getMessage());
                }
            }
            System.out.println();
            cols(c, "bs_qc_item");
            cols(c, "bs_qc_plan");
            cols(c, "qc_insp_rec_detail");
            cols(c, "qc_asm_insp_detail");
        }
    }

    static void cols(Connection c, String t) {
        System.out.println("=== " + t + " ===");
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('" + t + "') ORDER BY column_id")) {
            StringBuilder sb = new StringBuilder();
            while (rs.next()) sb.append(rs.getString(1)).append(" | ");
            System.out.println(sb);
        } catch (Exception e) {
            System.out.println("ERR=" + e.getMessage());
        }
        System.out.println();
    }
}
