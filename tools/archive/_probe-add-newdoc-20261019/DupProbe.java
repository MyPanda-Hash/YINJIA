import java.sql.*;

/**
 * 号池体检(只读):逐面板比对「业务表里的单号」与「s_allno 号池」。
 *
 * <p>背景:FormNoService.next() 取号只看号池自己(s_allno),不看业务表 ⇒ 导库/直接写库的单号
 * 没进池时,新增会**重发库里已存在的号**,新草稿立刻继承旧单的已审核状态(2026-10-19 用户报障)。
 *
 * <p>只体检「走号池的号」= 面板有 prefix 且单号形如 {@code 前缀-yyyy-MM-nnnn};遗留 ERP 表
 * (Porder / mate / bs_route 这些前缀为空的)本来就不走号池,它们的历史重号不在此列。
 *
 * <p>用法(在 tools 目录下):
 * <pre>
 *   java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_probe-add-newdoc-20261019/DupProbe.java [库名]
 * </pre>
 * 退出码:两段都干净 = 0,否则 1。
 */
public class DupProbe {

    private static final String NO_PATTERN = "-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]";

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=8";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            int dupPanels = dups(c);
            int missing = pool(c);
            boolean ok = dupPanels == 0 && missing == 0;
            System.out.println(ok ? "[PASS] 无重号、号池无缺号" : "[FAIL] 重号面板=" + dupPanels + ", 号池缺号=" + missing);
            if (!ok) System.exit(1);
        }
    }

    /** ① 走号池的面板:同一单号出现多行 = 重号(新增会撞旧单状态的最直接证据) */
    static int dups(Connection c) throws SQLException {
        System.out.println("-- ① 重号面板(只查 前缀-yyyy-MM-nnnn 形态的单号) --");
        String sql = "SELECT panel_code, ISNULL(head_table, line_table) t, group_col, prefix "
                + "FROM yj_panel WHERE prefix IS NOT NULL AND group_col IS NOT NULL AND mode = 'doc' AND head_table IS NOT NULL "
                + "AND (head_table IS NOT NULL OR line_table IS NOT NULL)";
        int bad = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String panel = rs.getString(1), table = rs.getString(2), col = rs.getString(3), prefix = rs.getString(4);
                String q = "SELECT COUNT(*) FROM (SELECT [" + col + "] FROM [" + table
                        + "] WHERE [" + col + "] LIKE ? GROUP BY [" + col + "] HAVING COUNT(*) > 1) x";
                try (PreparedStatement ps = c.prepareStatement(q)) {
                    ps.setString(1, prefix + NO_PATTERN);
                    try (ResultSet r = ps.executeQuery()) {
                        r.next();
                        int n = r.getInt(1);
                        if (n > 0) {
                            bad++;
                            System.out.println("  [DUP] " + panel + " (" + table + "." + col + ") 重号 " + n + " 个");
                        }
                    }
                } catch (SQLException e) {
                    System.out.println("  [SKIP] " + panel + " (" + table + "." + col + "): " + e.getMessage());
                }
            }
        }
        if (bad == 0) System.out.println("  无");
        return bad;
    }

    /** ② 每个走号池的面板:库里已有、号池里没有的单号(下一张新单就会重发这些号) */
    static int pool(Connection c) throws SQLException {
        System.out.println("-- ② 号池缺号(面板 / 库最大号 / 池最大号 / 未回登) --");
        String sql = "SELECT p.panel_code, p.prefix, ISNULL(p.head_table, p.line_table) t, p.group_col "
                + "FROM yj_panel p WHERE p.prefix IS NOT NULL AND p.group_col IS NOT NULL "
                + "AND (p.head_table IS NOT NULL OR p.line_table IS NOT NULL)";
        int missing = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String panel = rs.getString(1), prefix = rs.getString(2), table = rs.getString(3), col = rs.getString(4);
                String pattern = prefix + NO_PATTERN;
                String q = "SELECT"
                        + " (SELECT COUNT(*) FROM [" + table + "] h WHERE h.[" + col + "] LIKE ?"
                        + "    AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[" + col + "])) AS miss,"
                        + " (SELECT MAX([" + col + "]) FROM [" + table + "] WHERE [" + col + "] LIKE ?) AS maxdb,"
                        + " (SELECT MAX(dh) FROM s_allno WHERE lb = ? AND dh LIKE ?) AS maxpool";
                try (PreparedStatement ps = c.prepareStatement(q)) {
                    ps.setString(1, pattern);
                    ps.setString(2, pattern);
                    ps.setString(3, prefix);
                    ps.setString(4, prefix + "-%");
                    try (ResultSet r = ps.executeQuery()) {
                        r.next();
                        int miss = r.getInt("miss");
                        if (miss > 0) {
                            missing += miss;
                            System.out.println("  [MISS] " + panel + " (" + prefix + ") 库最大=" + r.getString("maxdb")
                                    + " 池最大=" + r.getString("maxpool") + " 未回登=" + miss);
                        }
                    }
                } catch (SQLException e) {
                    System.out.println("  [SKIP] " + panel + " (" + prefix + "): " + e.getMessage());
                }
            }
        }
        if (missing == 0) System.out.println("  无");
        return missing;
    }
}
