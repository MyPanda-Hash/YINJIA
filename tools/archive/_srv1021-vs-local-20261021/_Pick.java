import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/**
 * 定点取证(2026-10-21 服务器备份 vs 本地):把中文字面量写在源码里,
 * 避免命令行传参在 Windows 下被 GBK 化导致「列名无效」。
 */
public class _Pick {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";

    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        try (Connection srv = DriverManager.getConnection(String.format(BASE, "HSDZ_MES_SRV1021"), "sa", "Yinjia@2026");
             Connection loc = DriverManager.getConnection(String.format(BASE, "HSDZ_MES"), "sa", "Yinjia@2026")) {

            out.println("=== plang id=1171(服务器独有) ===");
            q(srv, out, "SELECT id, pl_no, pl_date, asp_user1, asp_time1 FROM plang WHERE id=1171");
            q(loc, out, "SELECT id, pl_no, pl_date, asp_user1, asp_time1 FROM plang WHERE id=1171");

            out.println("\n=== plang_pc id=2006(服务器独有) ===");
            q(srv, out, "SELECT TOP 3 * FROM plang_pc WHERE id=2006");

            out.println("\n=== wo_process_line ids 10051-10053(服务器独有) ===");
            q(srv, out, "SELECT id, 工单号, 工单行号, 工序名称, asp_user1, asp_time1 FROM wo_process_line WHERE id BETWEEN 10051 AND 10053");
            q(loc, out, "SELECT COUNT(*) AS 本地同工单行数 FROM wo_process_line WHERE 工单号=N'GD-2026-10-0198'");

            out.println("\n=== rd_insp_plan_head id=14(服务器独有) ===");
            q(srv, out, "SELECT TOP 1 * FROM rd_insp_plan_head WHERE id=14");

            out.println("\n=== s_allno 服务器独有 3 行 ===");
            q(srv, out, "SELECT comm, ID, s_no, s_type, s_state FROM s_allno WHERE ID IN (164176,164177,164178)");

            out.println("\n=== 本地作废的 3 张装配检验单(服务器状态) ===");
            q(srv, out, "SELECT s.doc_no, s.panel_code, s.canceled, s.saved, s.shr FROM HSDZ_MES_SRV1021.dbo.yj_doc_status s WHERE s.doc_no IN ('ZJ-2026-10-0013','ZJ-2026-10-0014','ZJ-2026-10-0009')");
            q(loc, out, "SELECT s.doc_no, s.panel_code, s.canceled, s.saved, s.shr FROM yj_doc_status s WHERE s.doc_no IN ('ZJ-2026-10-0013','ZJ-2026-10-0014','ZJ-2026-10-0009')");

            out.println("\n=== 最新业务时间戳对照 ===");
            String[][] checks = {
                {"bd_so_order", "MAX(asp_time1)"},
                {"bd_pu_order", "MAX(asp_time1)"},
                {"bd_sale_out", "MAX(asp_time1)"},
                {"bd_purchase_in", "MAX(asp_time1)"},
                {"qc_first_insp_head", "MAX(asp_time1)"},
                {"qc_proc_insp_head", "MAX(asp_time1)"},
                {"wo_process_line", "MAX(asp_time1)"},
            };
            for (String[] c : checks) {
                String sa = one(srv, "SELECT CONVERT(varchar(23), " + c[1] + ", 121) FROM " + c[0]);
                String sb = one(loc, "SELECT CONVERT(varchar(23), " + c[1] + ", 121) FROM " + c[0]);
                out.println(String.format("   %-24s 服务器=%s   本地=%s", c[0], sa, sb));
            }
            out.println("RESULT: DONE");
        }
    }

    static String one(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? String.valueOf(rs.getString(1)) : "(null)";
        } catch (SQLException e) { return "(ERR:" + e.getMessage() + ")"; }
    }

    static void q(Connection c, PrintStream out, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int rows = 0;
            while (rs.next() && rows++ < 12) {
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    if (v != null && v.length() > 40) v = v.substring(0, 40) + "…";
                    sb.append(i > 1 ? " | " : "").append(v);
                }
                out.println(sb);
            }
            if (rows == 0) out.println("   (0 行)");
        } catch (SQLException e) { out.println("   [ERR] " + e.getMessage()); }
    }
}
