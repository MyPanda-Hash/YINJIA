import java.sql.*;

/**
 * 只读:①bs_qc_plan 全字段(看适用存货怎么关联);②bs_qc_item 的标准上下限;
 * ③检验方案面板是否有「适用存货」数据。中文列名用 Unicode 转义。
 */
public class Q4 {
    static final String P_CODE = "\u65b9\u6848\u7f16\u7801";
    static final String P_NAME = "\u65b9\u6848\u540d\u79f0";
    static final String P_INV  = "\u9002\u7528\u5b58\u8d27";
    static final String P_INVC = "\u9002\u7528\u5b58\u8d27\u7c7b\u522b";
    static final String P_WAY  = "\u68c0\u9a8c\u65b9\u5f0f";
    static final String P_RATE = "\u62bd\u68c0\u6bd4\u4f8b%";
    static final String P_FILE = "\u6587\u4ef6\u7f16\u7801";
    static final String P_STD  = "\u6267\u884c\u6807\u51c6";
    static final String P_SAMP = "\u53d6\u6837\u89c4\u5219";

    static final String I_SEQ  = "\u5e8f\u53f7";
    static final String I_NAME = "\u9879\u76ee\u540d\u79f0";
    static final String I_STD  = "\u68c0\u9a8c\u6807\u51c6";
    static final String I_LO   = "\u6807\u51c6\u4e0b\u9650";
    static final String I_HI   = "\u6807\u51c6\u4e0a\u9650";
    static final String I_RULE = "\u5224\u5b9a\u89c4\u5219";
    static final String I_UNIT = "\u8ba1\u91cf\u5355\u4f4d";

    public static void main(String[] a) throws Exception {
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, "UTF-8");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            out.println("### bs_qc_plan 全部 ###");
            dump(c, out, "SELECT id, " + P_CODE + ", " + P_NAME + ", " + P_INV + ", " + P_INVC + ", "
                + P_WAY + ", " + P_RATE + ", " + P_FILE + ", " + P_STD + ", " + P_SAMP + " FROM bs_qc_plan ORDER BY id");

            out.println("### bs_qc_item 标准上下限 ###");
            dump(c, out, "SELECT " + I_SEQ + ", " + I_NAME + ", " + I_STD + ", " + I_LO + ", " + I_HI
                + ", " + I_UNIT + ", " + I_RULE + " FROM bs_qc_item ORDER BY " + P_CODE + ", " + I_SEQ);

            out.println("### bs_qc_plan 是否有数据(总数) ###");
            dump(c, out, "SELECT COUNT(*) AS cnt FROM bs_qc_plan");
        }
    }

    static void dump(Connection c, java.io.PrintStream out, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(" | ");
            out.println(h);
            int rows = 0;
            while (rs.next()) {
                rows++;
                StringBuilder r = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    r.append(v == null ? "-" : String.valueOf(v).replace("\n", " ")).append(" | ");
                }
                out.println(r);
            }
            out.println("(rows=" + rows + ")");
        } catch (Exception e) {
            out.println("ERR=" + e.getMessage());
        }
        out.println();
    }
}
