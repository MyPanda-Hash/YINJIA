import java.sql.*;
import java.util.*;

/** 用 UTF-8 直出中文列名与样本数据(避免控制台 GBK 乱码)。 */
public class Q2 {
    public static void main(String[] a) throws Exception {
        java.io.PrintStream out = new java.io.PrintStream(System.out, true, "UTF-8");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            out.println("### bs_qc_item 列 ###");
            cols(c, out, "bs_qc_item");
            out.println("### bs_qc_plan 列 ###");
            cols(c, out, "bs_qc_plan");
            out.println("### qc_asm_insp_detail 列 ###");
            cols(c, out, "qc_asm_insp_detail");
            out.println("### qc_insp_rec_detail 列 ###");
            cols(c, out, "qc_insp_rec_detail");

            out.println("### bs_qc_plan 数据(方案) ###");
            dump(c, out, "SELECT id, 方案编码, 方案名称, 适用存货, 检验方式, 抽检比例, 文件编码, 执行标准 FROM bs_qc_plan ORDER BY id");

            out.println("### bs_qc_item 数据(检验项目,前 20) ###");
            dump(c, out, "SELECT TOP 20 id, 方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 判定规则, 取样要求, 检验方法 FROM bs_qc_item ORDER BY 方案编码, 序号");

            out.println("### qc_asm_insp_detail 数据 ###");
            dump(c, out, "SELECT TOP 20 id, 单据编号, 行号, 表区, 检验项目, 标准要求, 实测数值, 判定, 检验方法 FROM qc_asm_insp_detail ORDER BY id");
        }
    }

    static void cols(Connection c, java.io.PrintStream out, String t) throws Exception {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('" + t + "') ORDER BY column_id")) {
            StringBuilder sb = new StringBuilder();
            while (rs.next()) sb.append(rs.getString(1)).append(" | ");
            out.println(sb);
        }
        out.println();
    }

    static void dump(Connection c, java.io.PrintStream out, String sql) throws Exception {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append("\t");
            out.println(h);
            while (rs.next()) {
                StringBuilder r = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    r.append(v == null ? "" : String.valueOf(v).replace("\n", " ")).append("\t");
                }
                out.println(r);
            }
        }
        out.println();
    }
}
