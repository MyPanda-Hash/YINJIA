import java.sql.*;

/**
 * 中文列名一律用 Unicode 转义字面量(编译期不会被编码破坏)。
 * 只读:查检验方案/检验项目/工序检验明细的实际数据。
 */
public class Q3 {
    // bs_qc_plan
    static final String P_CODE = "\u65b9\u6848\u7f16\u7801";        // 方案编码
    static final String P_NAME = "\u65b9\u6848\u540d\u79f0";        // 方案名称
    static final String P_INV  = "\u9002\u7528\u5b58\u8d27";        // 适用存货
    static final String P_WAY  = "\u68c0\u9a8c\u65b9\u5f0f";        // 检验方式
    static final String P_RATE = "\u62bd\u68c0\u6bd4\u4f8b%";       // 抽检比例%
    static final String P_FILE = "\u6587\u4ef6\u7f16\u7801";        // 文件编码
    static final String P_STD  = "\u6267\u884c\u6807\u51c6";        // 执行标准

    // bs_qc_item
    static final String I_SEQ  = "\u5e8f\u53f7";                    // 序号
    static final String I_CODE = "\u9879\u76ee\u7f16\u7801";        // 项目编码
    static final String I_NAME = "\u9879\u76ee\u540d\u79f0";        // 项目名称
    static final String I_CONT = "\u68c0\u9a8c\u5185\u5bb9";        // 检验内容
    static final String I_STD  = "\u68c0\u9a8c\u6807\u51c6";        // 检验标准
    static final String I_RULE = "\u5224\u5b9a\u89c4\u5219";        // 判定规则
    static final String I_SAMP = "\u53d6\u6837\u8981\u6c42";        // 取样要求
    static final String I_METH = "\u68c0\u9a8c\u65b9\u6cd5";        // 检验方法

    // qc_asm_insp_detail
    static final String A_NO   = "\u5355\u636e\u7f16\u53f7";        // 单据编号
    static final String A_LINE = "\u884c\u53f7";                    // 行号
    static final String A_ZONE = "\u8868\u533a";                    // 表区
    static final String A_ITEM = "\u68c0\u9a8c\u9879\u76ee";        // 检验项目
    static final String A_REQ  = "\u6807\u51c6\u8981\u6c42";        // 标准要求
    static final String A_VAL  = "\u5b9e\u6d4b\u6570\u503c";        // 实测数值
    static final String A_JUDGE= "\u5224\u5b9a";                    // 判定
    static final String A_METH = "\u68c0\u9a8c\u65b9\u6cd5";        // 检验方法

    public static void main(String[] a) throws Exception {
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, "UTF-8");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            out.println("### bs_qc_plan (\u68c0\u9a8c\u65b9\u6848) ###");
            dump(c, out, "SELECT id, " + P_CODE + ", " + P_NAME + ", " + P_INV + ", " + P_WAY
                + ", " + P_RATE + ", " + P_FILE + ", " + P_STD + " FROM bs_qc_plan ORDER BY id");

            out.println("### bs_qc_item (\u68c0\u9a8c\u9879\u76ee) ###");
            dump(c, out, "SELECT id, " + P_CODE + ", " + I_SEQ + ", " + I_CODE + ", " + I_NAME
                + ", " + I_CONT + ", " + I_STD + ", " + I_RULE + ", " + I_SAMP + ", " + I_METH
                + " FROM bs_qc_item ORDER BY " + P_CODE + ", " + I_SEQ);

            out.println("### qc_asm_insp_detail (\u7ec4\u88c5\u6210\u54c1\u68c0\u9a8c\u660e\u7ec6) ###");
            dump(c, out, "SELECT TOP 15 id, " + A_NO + ", " + A_LINE + ", " + A_ZONE + ", " + A_ITEM
                + ", " + A_REQ + ", " + A_VAL + ", " + A_JUDGE + ", " + A_METH
                + " FROM qc_asm_insp_detail ORDER BY id");
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
