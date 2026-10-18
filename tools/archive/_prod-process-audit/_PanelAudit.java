import java.sql.*;
import java.util.*;

/**
 * _PanelAudit.java — 「生产过程」10 张单据体检(只读)2026-10-18
 *
 * 回答用户口径「有一些单据还是空的,有一些功能也不完善」到底指哪些:
 *   ① 面板在 yj_panel 里是否存在(不存在 ⇒ 菜单点了也打不开);
 *   ② 每张面板的 yj_field 字段数 / 可见数 / 必填数 / place 分布(字段 0 条 ⇒ 空白表单);
 *   ③ 每张面板底表是否存在、有多少行(0 行 ⇒ 打开就是空表);
 *   ④ 每张面板底表有几个物理列(列少得像半成品 ⇒ 功能不完善)。
 *
 * 用法(tools 目录):
 *   java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_prod-process-audit/_PanelAudit.java [库名]
 *   库名默认 HSDZ_MES;口令取环境变量 YINJIA_SQL_PASS(默认 Yinjia@2026)。
 */
public class _PanelAudit {

    static final String[] PANELS = {
        "WO_REPORT", "WO_REPORT_LIST", "WO_COMPLETION_LIST", "PROD_ABN",
        "DAY_REPORT", "FEED_CONFIRM", "MIX_RECORD", "GRAN_RECORD", "WH_RECORD", "PACK_CONFIRM",
    };

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        int issues = 0;
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            System.out.println("-- yj_panel 列 --");
            dumpColumns(c, "yj_panel");
            System.out.println("-- yj_field 列 --");
            dumpColumns(c, "yj_field");
            System.out.println();

            for (String code : PANELS) {
                System.out.println("──────── " + code + " ────────");
                Map<String, Object> panel = firstRow(c,
                    "SELECT p.* FROM yj_panel p WHERE p.panel_code = ?", code);
                if (panel == null) {
                    // 面板码列可能不叫 panel_code
                    panel = firstRow(c, "SELECT TOP 1 p.* FROM yj_panel p WHERE ISNULL(p.panel_code,'') = ?", code);
                }
                if (panel == null) {
                    System.out.println("  [MISSING] yj_panel 里没有这张面板");
                    issues++;
                    System.out.println();
                    continue;
                }
                String name = str(panel.get("panel_name"), str(panel.get("name"), ""));
                String head = str(panel.get("head_table"), "");
                String line = str(panel.get("line_table"), "");
                System.out.println("  面板: " + name + "  mode=" + str(panel.get("mode"), "")
                    + " category=" + str(panel.get("category"), "")
                    + " head=" + (head.isEmpty() ? "-" : head) + " line=" + (line.isEmpty() ? "-" : line));
                for (String t : new String[]{head, line}) {
                    if (t == null || t.isBlank()) continue;
                    int cols = count(c, "SELECT COUNT(1) FROM sys.columns WHERE object_id = OBJECT_ID(?)", "dbo." + t);
                    if (cols == 0) { System.out.println("    [缺表] dbo." + t); issues++; continue; }
                    int rows = count(c, "SELECT COUNT(1) FROM dbo." + t);
                    System.out.println("    表 dbo." + t + " 列=" + cols + " 行=" + rows + (rows == 0 ? "  [空]" : ""));
                }
                String tableName = findTable(panel);

                // 字段统计
                int total = count(c, "SELECT COUNT(1) FROM yj_field WHERE panel_code = ?", code);
                int visible = count(c, "SELECT COUNT(1) FROM yj_field WHERE panel_code = ? AND ISNULL(visible,1)=1", code);
                int required = count(c, "SELECT COUNT(1) FROM yj_field WHERE panel_code = ? AND ISNULL(required,0)=1", code);
                System.out.println("  字段: 总=" + total + " 可见=" + visible + " 必填=" + required);
                if (total == 0) { System.out.println("  [空表单] 没有任何字段"); issues++; }

                // place 分布
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT ISNULL(place,'(null)') AS pl, COUNT(1) c FROM yj_field WHERE panel_code = ? GROUP BY place ORDER BY pl")) {
                    ps.setString(1, code);
                    ResultSet rs = ps.executeQuery();
                    StringBuilder sb = new StringBuilder();
                    while (rs.next()) sb.append(rs.getString("pl")).append("=").append(rs.getInt("c")).append("  ");
                    System.out.println("  place: " + sb);
                }

                // 字段名清单
                List<String> labels = new ArrayList<>();
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT label FROM yj_field WHERE panel_code = ? ORDER BY seq, id")) {
                    ps.setString(1, code);
                    ResultSet rs = ps.executeQuery();
                    while (rs.next()) labels.add(rs.getString(1));
                }
                System.out.println("  字段名: " + String.join(" | ", labels));

                // 底表
                if (tableName != null && !tableName.isBlank()) {
                    int cols = count(c, "SELECT COUNT(1) FROM sys.columns WHERE object_id = OBJECT_ID(?)", "dbo." + tableName);
                    if (cols == 0) {
                        System.out.println("  [缺表] 物理表 dbo." + tableName + " 不存在");
                        issues++;
                    } else {
                        int rows = count(c, "SELECT COUNT(1) FROM dbo." + tableName);
                        System.out.println("  底表: dbo." + tableName + " 列=" + cols + " 行=" + rows);
                        if (rows == 0) System.out.println("  [空表] 0 行");
                    }
                } else {
                    System.out.println("  [?] 取不到底表名");
                }
                System.out.println();
            }
        }
        System.out.println(issues == 0 ? "RESULT: PASS" : "RESULT: 发现 " + issues + " 处结构性问题");
    }

    static void dumpColumns(Connection c, String t) throws SQLException {
        StringBuilder sb = new StringBuilder();
        try (ResultSet rs = c.getMetaData().getColumns(c.getCatalog(), "dbo", t, null)) {
            while (rs.next()) sb.append(rs.getString("COLUMN_NAME")).append(" ");
        }
        System.out.println("  " + sb);
    }

    static Map<String, Object> firstRow(Connection c, String sql, Object... args) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                ResultSetMetaData md = rs.getMetaData();
                Map<String, Object> m = new LinkedHashMap<>();
                for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnLabel(i), rs.getObject(i));
                return m;
            }
        }
    }

    static int count(Connection c, String sql, Object... args) {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
        } catch (SQLException e) { return -1; }
    }

    static String findTable(Map<String, Object> panel) {
        for (String k : panel.keySet()) {
            String lk = k.toLowerCase();
            if (lk.contains("table") && panel.get(k) != null) return String.valueOf(panel.get(k));
        }
        return null;
    }

    static String str(Object v, String def) { return v == null || String.valueOf(v).isBlank() ? def : String.valueOf(v); }
}
