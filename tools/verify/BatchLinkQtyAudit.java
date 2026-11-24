import java.sql.*;
import java.util.*;

/**
 * BatchLinkQtyAudit.java — 分批送料「占用 vs 单据实际数量」漂移体检(只读)
 *
 * 为什么有它(2026-11-24 客户报障「生单数量是 4000，这里只有 200」):
 *   `form_flow_link.linked_quantity`(占用/已送)与 `yj_doc_batch.batch_qty`(批次台账)只在
 *   **生单那一刻**写一次；之后在草稿里改暂收单行的「数量」不回写 ⇒ 该订单行「已送」虚高、
 *   「剩余」被吃光，客户在单据上看到的就是「订单 4000 / 实收 200」。
 *   生产实例:采购订单 YJ-20261103-06 行6(YJ-GL-012) 占用 4000、暂收单 SL-2026-11-0028 只有 200。
 *   代码侧已在保存暂收单时回写(BatchService.syncReceiptLinks)，本工具负责**事后发现**这类漂移。
 *
 * 查什么(target_panel_code='QC_RECV' 的 ACTIVE 占用，即「采购订单 → 送料暂收单」这条链):
 *   ① 占用指向的暂收行不存在 / 已软删(占用没释放 ⇒ 订单行额度被占死)
 *   ② 占用数量 ≠ 暂收行当前数量(改单没回写)
 *   ③ 批次台账 batch_qty ≠ 该批次 ACTIVE 占用对应行数量合计
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar verify\BatchLinkQtyAudit.java                # 查 HSDZ_MES
 *   java -cp lib\mssql-jdbc.jar verify\BatchLinkQtyAudit.java HSDZ_MES_TEST
 *   java -Dstdout.encoding=UTF-8 ...                                         # 中文不错行
 *
 * 退出码:0 = 全绿；1 = 有漂移(附明细)；2 = 连不上/缺表。
 * 修数:tools/migrate-batch-link-qty-sync-20261124.sql(幂等，两账套都要跑)。
 */
public class BatchLinkQtyAudit {

    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    /** 容差:数量是 decimal(18,4),浮点尾差不算漂移 */
    static final double EPS = 0.00005d;
    /** 目标面板 = 送料暂收单(分批送料链的头一跳) */
    static final String TARGET_PANEL = "QC_RECV";
    /** 明细最多打这么多行(防止刷屏) */
    static final int MAX_DETAIL = 30;

    public static void main(String[] args) {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";

        try (Connection c = DriverManager.getConnection(url, USER, PASS)) {
            System.out.println("[库] " + db + "  @" + c.getMetaData().getDatabaseProductName());
            int bad = 0;
            bad += checkRowBroken(c);
            bad += checkQtyDrift(c);
            bad += checkBatchQty(c);
            System.out.println();
            if (bad == 0) {
                System.out.println("[PASS] 分批送料占用与单据实际数量一致(可送上限/剩余量可信)");
                System.exit(0);
            } else {
                System.out.println("[FAIL] 发现 " + bad + " 处漂移；修数用 tools/migrate-batch-link-qty-sync-20261124.sql");
                System.exit(1);
            }
        } catch (SQLException e) {
            System.err.println("[FATAL] " + e.getMessage());
            System.exit(2);
        }
    }

    /** ① 占用指向的行不存在 / 已作废(占用没释放) */
    static int checkRowBroken(Connection c) throws SQLException {
        String sql = "SELECT f.id, f.source_form_no, f.target_form_no, f.target_line_key, f.linked_quantity,"
                + " d.id AS rid, d.cx AS cx"
                + " FROM form_flow_link f"
                + " OUTER APPLY (SELECT x.id, x.asp_cancel AS cx FROM sl_recv_detail x"
                + "               WHERE x.id = TRY_CAST(RIGHT(f.target_line_key,"
                + "                      CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)) d"
                + " WHERE f.target_panel_code = ? AND f.link_status = 'ACTIVE'"
                + "   AND (d.id IS NULL OR d.cx = 'Y')";
        List<String> rows = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, TARGET_PANEL);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    rows.add(String.format("    订单 %s → 暂收 %s | 行键 %s | 占用 %s | %s",
                            rs.getString("source_form_no"), rs.getString("target_form_no"),
                            rs.getString("target_line_key"), num(rs.getString("linked_quantity")),
                            rs.getString("rid") == null ? "行不存在" : "行已作废"));
                }
            }
        }
        System.out.println();
        System.out.println("① 占用指向失效行(占用该释放) : " + rows.size() + (rows.isEmpty() ? " ✅" : " ❌"));
        rows.stream().limit(MAX_DETAIL).forEach(System.out::println);
        if (rows.size() > MAX_DETAIL) System.out.println("    … 另有 " + (rows.size() - MAX_DETAIL) + " 行");
        return rows.size();
    }

    /** ② 占用数量 ≠ 暂收行当前数量 */
    static int checkQtyDrift(Connection c) throws SQLException {
        String sql = "SELECT f.source_form_no, f.target_form_no, f.target_line_key, f.linked_quantity,"
                + " d.物料编码 AS mat, d.数量 AS qty, ISNULL(f.linked_quantity,0) - ISNULL(d.数量,0) AS diff"
                + " FROM form_flow_link f"
                + " JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key,"
                + "        CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)"
                + " WHERE f.target_panel_code = ? AND f.link_status = 'ACTIVE'"
                + "   AND ISNULL(d.asp_cancel,'N') <> 'Y'"
                + "   AND ABS(ISNULL(f.linked_quantity,0) - ISNULL(d.数量,0)) > ?"
                + " ORDER BY ABS(ISNULL(f.linked_quantity,0) - ISNULL(d.数量,0)) DESC";
        List<String> rows = new ArrayList<>();
        double diffSum = 0d;
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, TARGET_PANEL);
            ps.setDouble(2, EPS);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    double diff = rs.getDouble("diff");
                    diffSum += diff;
                    rows.add(String.format("    订单 %s → 暂收 %s | %s | 占用 %s / 实际 %s (差 %s)",
                            rs.getString("source_form_no"), rs.getString("target_form_no"),
                            rs.getString("mat"), num(rs.getString("linked_quantity")),
                            num(rs.getString("qty")), num(String.valueOf(diff))));
                }
            }
        }
        System.out.println();
        System.out.println("② 占用数量 ≠ 暂收行数量 : " + rows.size() + (rows.isEmpty() ? " ✅" : " ❌")
                + (rows.isEmpty() ? "" : String.format("(差额合计 %s)", num(String.valueOf(diffSum)))));
        rows.stream().limit(MAX_DETAIL).forEach(System.out::println);
        if (rows.size() > MAX_DETAIL) System.out.println("    … 另有 " + (rows.size() - MAX_DETAIL) + " 行");
        return rows.size();
    }

    /** ③ 批次台账 batch_qty ≠ 该批次 ACTIVE 占用对应行数量合计 */
    static int checkBatchQty(Connection c) throws SQLException {
        String sql = "SELECT b.id, b.batch_no, b.source_form_no, b.target_form_no,"
                + " ISNULL(CAST(b.batch_qty AS decimal(18,4)),0) AS batch_qty, s.qty AS actual"
                + " FROM yj_doc_batch b"
                + " JOIN (SELECT f.batch_id AS bid, SUM(ISNULL(d.数量,0)) AS qty"
                + "         FROM form_flow_link f"
                + "         JOIN sl_recv_detail d ON d.id = TRY_CAST(RIGHT(f.target_line_key,"
                + "               CHARINDEX('#', REVERSE(f.target_line_key)) - 1) AS int)"
                + "        WHERE f.target_panel_code = ? AND f.link_status = 'ACTIVE'"
                + "          AND ISNULL(d.asp_cancel,'N') <> 'Y' AND f.batch_id IS NOT NULL"
                + "        GROUP BY f.batch_id) s ON s.bid = b.id"
                + " WHERE ABS(ISNULL(CAST(b.batch_qty AS decimal(18,4)),0) - s.qty) > ?";
        List<String> rows = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, TARGET_PANEL);
            ps.setDouble(2, EPS);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    rows.add(String.format("    批次 %s (id=%d) 订单 %s → 暂收 %s | 台账 %s / 实际 %s",
                            rs.getString("batch_no"), rs.getInt("id"), rs.getString("source_form_no"),
                            rs.getString("target_form_no"),
                            num(rs.getString("batch_qty")), num(rs.getString("actual"))));
                }
            }
        }
        System.out.println();
        System.out.println("③ 批次台账 batch_qty 与实际送料量不符 : " + rows.size() + (rows.isEmpty() ? " ✅" : " ❌"));
        rows.stream().limit(MAX_DETAIL).forEach(System.out::println);
        if (rows.size() > MAX_DETAIL) System.out.println("    … 另有 " + (rows.size() - MAX_DETAIL) + " 行");
        return rows.size();
    }

    /** 数量原样打印:整数不带 .0,小数最多 4 位 */
    static String num(String s) {
        if (s == null || s.isBlank()) return "0";
        try {
            double d = Double.parseDouble(s);
            if (Math.abs(d - Math.rint(d)) < 1e-9) return String.valueOf((long) Math.rint(d));
            return String.valueOf(Math.round(d * 10000.0) / 10000.0);
        } catch (NumberFormatException e) {
            return s;
        }
    }
}
