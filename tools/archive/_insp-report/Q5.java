import java.sql.*;

/**
 * 只读核查:生产过程中的检验数据实际分布(三类工序检验单 + 明细)。
 * 中文列名用 Unicode 转义。
 */
public class Q5 {
    static final String H_NO   = "\u5355\u636e\u7f16\u53f7";        // 单据编号
    static final String H_WO   = "\u5de5\u5355\u53f7";              // 工单号
    static final String H_DATE = "\u5355\u636e\u65e5\u671f";        // 单据日期
    static final String H_PLAN = "\u68c0\u9a8c\u65b9\u6848";        // 检验方案
    static final String H_FILE = "\u6587\u4ef6\u7f16\u7801";        // 文件编码
    static final String H_STD  = "\u6267\u884c\u6807\u51c6";        // 执行标准

    static final String D_NO   = "\u5355\u636e\u7f16\u53f7";        // 单据编号
    static final String D_ZONE = "\u8868\u533a";                    // 表区
    static final String D_ITEM = "\u68c0\u9a8c\u9879\u76ee";        // 检验项目
    static final String D_REQ  = "\u6807\u51c6\u8981\u6c42";        // 标准要求
    static final String D_VAL  = "\u5b9e\u6d4b\u6570\u503c";        // 实测数值
    static final String D_JUD  = "\u5224\u5b9a";                    // 判定
    static final String D_METH = "\u68c0\u9a8c\u65b9\u6cd5";        // 检验方法

    public static void main(String[] a) throws Exception {
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, "UTF-8");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            out.println("### 三类工序检验单 头表 ###");
            for (String t : new String[]{"qc_mold_insp_head", "qc_cut_insp_head", "qc_asm_insp_head"}) {
                out.println("--- " + t + " ---");
                dump(c, out, "SELECT id, " + H_NO + ", " + H_WO + ", " + H_DATE + ", " + H_PLAN
                    + ", " + H_FILE + ", " + H_STD + " FROM " + t + " ORDER BY id");
            }

            out.println("### 三类工序检验单 明细(按表区分组计数) ###");
            for (String t : new String[]{"qc_mold_insp_detail", "qc_cut_insp_detail", "qc_asm_insp_detail"}) {
                out.println("--- " + t + " 表区分布 ---");
                dump(c, out, "SELECT " + D_ZONE + " AS zone, COUNT(*) AS cnt FROM " + t + " GROUP BY " + D_ZONE);
            }

            out.println("### 成型检验明细(全部) ###");
            dump(c, out, "SELECT " + D_NO + ", " + D_ZONE + ", " + D_ITEM + ", " + D_REQ + ", "
                + D_VAL + ", " + D_JUD + " FROM qc_mold_insp_detail ORDER BY id");

            out.println("### 切炭检验明细(全部) ###");
            dump(c, out, "SELECT " + D_NO + ", " + D_ZONE + ", " + D_ITEM + ", " + D_REQ + ", "
                + D_VAL + ", " + D_JUD + " FROM qc_cut_insp_detail ORDER BY id");

            out.println("### 组装成品检验明细(全部) ###");
            dump(c, out, "SELECT " + D_NO + ", " + D_ZONE + ", " + D_ITEM + ", " + D_REQ + ", "
                + D_VAL + ", " + D_JUD + ", " + D_METH + " FROM qc_asm_insp_detail ORDER BY id");
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
