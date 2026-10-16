import java.sql.*;

/**
 * 只读:核对「销售出库单 → 产品物料 → 工单 → 工序检验单」这条链能否走通。
 * 中文列名用 Unicode 转义。
 */
public class Q6 {
    static final String S_NO   = "\u5355\u636e\u7f16\u53f7";       // 单据编号
    static final String S_INV  = "\u5b58\u8d27\u7f16\u7801";       // 存货编码
    static final String S_NAME = "\u5b58\u8d27\u540d\u79f0";       // 存货名称

    public static void main(String[] a) throws Exception {
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, "UTF-8");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            out.println("### 销售出库单明细的产品(存货编码/名称) ###");
            dump(c, out, "SELECT DISTINCT TOP 20 " + S_INV + ", " + S_NAME
                + " FROM bl_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY " + S_INV);

            out.println("### 工单(plang)的产品 ###");
            dump(c, out, "SELECT DISTINCT TOP 20 dm AS \u4ea7\u54c1\u7f16\u7801, mc AS \u4ea7\u54c1\u540d\u79f0"
                + " FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY dm");

            out.println("### 组装成品检验单 明细(检验项目区) ###");
            dump(c, out, "SELECT \u5355\u636e\u7f16\u53f7, \u8868\u533a, \u68c0\u9a8c\u9879\u76ee, \u6807\u51c6\u8981\u6c42, \u5b9e\u6d4b\u6570\u503c, \u5224\u5b9a"
                + " FROM qc_asm_insp_detail WHERE \u8868\u533a=N'\u68c0\u9a8c\u9879\u76ee'");

            out.println("### 成型检验单 明细(检验项目区,含实测) ###");
            dump(c, out, "SELECT \u5355\u636e\u7f16\u53f7, \u68c0\u9a8c\u9879\u76ee, \u6807\u51c6\u8981\u6c42, \u5b9e\u6d4b\u6570\u503c, \u5224\u5b9a"
                + " FROM qc_mold_insp_detail WHERE \u8868\u533a=N'\u68c0\u9a8c\u9879\u76ee'");

            out.println("### 切炭检验单 明细(检验项目区) ###");
            dump(c, out, "SELECT \u5355\u636e\u7f16\u53f7, \u68c0\u9a8c\u9879\u76ee, \u6807\u51c6\u8981\u6c42, \u5b9e\u6d4b\u6570\u503c, \u5224\u5b9a"
                + " FROM qc_cut_insp_detail WHERE \u8868\u533a=N'\u68c0\u9a8c\u9879\u76ee'");
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
