import java.sql.*;

/**
 * 清理 ego 实测造出来的那张测试单(TL-2026-11-0019)。
 *
 * <p>AGENTS §5⑨:验证链路造的测试单必须立即删干净 —— 头 / 明细 / 状态 / 修改留痕 四张表。
 * <p>硬闸门:只允许在 HSDZ_MES_TEST(测试库)执行,库名不对直接退出。
 */
public class _CleanupDoc {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
        String no = args.length > 1 ? args[1] : "TL-2026-11-0019";
        if (!"HSDZ_MES_TEST".equals(db)) {
            System.out.println("拒绝执行:本脚本只允许在测试库 HSDZ_MES_TEST 跑,收到 = " + db);
            return;
        }
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            int detail = del(c, "DELETE FROM bl_material_ret WHERE 单据编号=?", no);
            int head = del(c, "DELETE FROM bd_material_ret WHERE 单据编号=?", no);
            int status = del(c, "DELETE FROM yj_doc_status WHERE panel_code='MATERIAL_RET' AND doc_no=?", no);
            int log = del(c, "DELETE FROM yj_doc_modify_log WHERE panel_code='MATERIAL_RET' AND doc_no=?", no);
            c.commit();
            System.out.printf("已清理 %s: 明细 %d 行 / 头 %d 行 / 状态 %d 行 / 修改留痕 %d 行%n",
                no, detail, head, status, log);

            // 复核:四张表里不能再有这个单号
            int left = 0;
            left += count(c, "SELECT COUNT(*) FROM bd_material_ret WHERE 单据编号=?", no);
            left += count(c, "SELECT COUNT(*) FROM bl_material_ret WHERE 单据编号=?", no);
            left += count(c, "SELECT COUNT(*) FROM yj_doc_status WHERE doc_no=?", no);
            left += count(c, "SELECT COUNT(*) FROM yj_doc_modify_log WHERE doc_no=?", no);
            System.out.println(left == 0 ? "复核 PASS:残留 0 行" : "复核 FAIL:仍残留 " + left + " 行");
        } catch (SQLException e) {
            System.out.println("ERR " + e.getMessage());
        }
    }

    private static int del(Connection c, String sql, String no) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, no);
            return ps.executeUpdate();
        }
    }

    private static int count(Connection c, String sql, String no) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, no);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }
}
