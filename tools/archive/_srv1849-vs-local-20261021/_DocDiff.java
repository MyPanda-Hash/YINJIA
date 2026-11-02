import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/**
 * 单据级差异(只读):对每张业务表按「单据编号 / 单号 / 工单号」做双向 EXCEPT,
 * 打印「仅服务器有 / 仅本地有」的单据号,避免整表行级 diff 的噪声。
 *
 * 用法: java _DocDiff.java <库A(服务器)> <库B(本地)> [--max N]
 */
public class _DocDiff {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";

    /** 表 -> 单据号列候选(按顺序尝试) */
    static final String[][] TABLES = {
            {"bd_so_order"}, {"bl_so_order"},
            {"bd_pu_order"}, {"bl_pu_order"},
            {"bd_purchase_in"}, {"bl_purchase_in"},
            {"bd_pu_label"}, {"bl_pu_label"},
            {"qc_first_insp_head"}, {"qc_proc_insp_head"}, {"qc_asm_insp_head"},
            {"qc_insp"}, {"qc_insp_detail"}, {"qc_insp_rec"}, {"qc_insp_rec_detail"},
            {"qc_return"}, {"qc_return_detail"}, {"qc_catalog"}, {"qc_catalog_detail"},
            {"sl_recv"}, {"sl_recv_detail"},
            {"rd_insp_plan_head"}, {"rd_approval"}, {"rd_mold_proc_head"},
            {"plang"}, {"plang_pc"}, {"scjl"}, {"wo_process_line"}, {"wo_transfer_log"},
            {"equip_check"}, {"maint_plan"}, {"erp_imp_log"},
            {"yj_barcode_label_log"}, {"yj_doc_batch"}, {"yj_doc_modify_log"}
    };
    static final String[] DOC_COLS = {"单据编号", "单号", "工单号", "document_no", "doc_no"};

    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String dbA = a[0], dbB = a[1];
        int max = 200;
        for (int i = 2; i < a.length; i++) if (a[i].equals("--max")) max = Integer.parseInt(a[++i]);

        try (Connection c = DriverManager.getConnection(String.format(BASE, "master"), "sa", "Yinjia@2026")) {
            for (String[] t : TABLES) {
                String table = t[0];
                String col = docCol(c, dbB, table);
                if (col == null) col = docCol(c, dbA, table);
                if (col == null) { out.println("\n### " + table + "  (无单据号列,跳过)"); continue; }
                out.println("\n### " + table + "   单据列=" + col);
                query(c, out, dbA, dbB, table, col, max);
            }
        }
    }

    static void query(Connection c, PrintStream out, String dbA, String dbB, String table, String col, int max) throws SQLException {
        String base = "SELECT CAST([" + col + "] AS nvarchar(200)) v FROM [%s].dbo.[" + table + "]";
        String onlyA = "SELECT v FROM (" + String.format(base, dbA) + " EXCEPT " + String.format(base, dbB) + ") x ORDER BY v";
        String onlyB = "SELECT v FROM (" + String.format(base, dbB) + " EXCEPT " + String.format(base, dbA) + ") x ORDER BY v";
        String cntA = "SELECT COUNT(*) FROM (" + String.format(base, dbA) + " EXCEPT " + String.format(base, dbB) + ") x";
        String cntB = "SELECT COUNT(*) FROM (" + String.format(base, dbB) + " EXCEPT " + String.format(base, dbA) + ") x";
        long nA = scalar(c, cntA), nB = scalar(c, cntB);
        out.println("  仅服务器(库A)=" + nA + "   仅本地(库B)=" + nB);
        if (nA > 0) out.println("   [仅服务器] " + join(c, onlyA, max));
        if (nB > 0) out.println("   [仅本地]   " + join(c, onlyB, max));
    }

    static String join(Connection c, String sql, int max) throws SQLException {
        StringBuilder sb = new StringBuilder();
        int n = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                if (n >= max) { sb.append(" …(截断)"); break; }
                sb.append(n++ > 0 ? ", " : "").append(rs.getString(1));
            }
        }
        return sb.toString();
    }

    static long scalar(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        }
    }

    static String docCol(Connection c, String db, String table) throws SQLException {
        for (String cand : DOC_COLS) {
            String sql = "SELECT COUNT(*) FROM [" + db + "].sys.tables t JOIN [" + db + "].sys.columns c "
                    + "ON c.object_id=t.object_id WHERE t.name=? AND c.name=?";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, table); ps.setString(2, cand);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next() && rs.getInt(1) > 0) return cand;
                }
            }
        }
        return null;
    }
}
