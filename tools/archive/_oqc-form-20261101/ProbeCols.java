import java.sql.*;
import java.util.*;

/** 比较正式库/测试库若干表的列集合差异(造数可行性)。 */
public class ProbeCols {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
    public static void main(String[] a) throws Exception {
        String[] tabs = {"rd_insp_plan_head", "rd_insp_plan_detail", "qc_asm_insp_head", "qc_asm_insp_detail",
                "qc_first_insp_head", "qc_first_insp_detail", "qc_proc_insp_head", "qc_proc_insp_detail",
                "bd_sale_out", "bl_sale_out", "yj_doc_status"};
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            for (String t : tabs) {
                List<String> prod = cols(c, "HSDZ_MES", t);
                List<String> test = cols(c, "HSDZ_MES_TEST", t);
                Set<String> onlyProd = new LinkedHashSet<>(prod); onlyProd.removeAll(test);
                Set<String> onlyTest = new LinkedHashSet<>(test); onlyTest.removeAll(prod);
                System.out.println("== " + t + " prod=" + prod.size() + " test=" + test.size()
                        + " onlyProd=" + onlyProd + " onlyTest=" + onlyTest);
            }
        }
    }
    static List<String> cols(Connection c, String db, String t) {
        List<String> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT COLUMN_NAME FROM " + db + ".INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION")) {
            ps.setString(1, t);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(rs.getString(1)); }
        } catch (Exception e) { out.add("ERR:" + e.getMessage()); }
        return out;
    }
}
