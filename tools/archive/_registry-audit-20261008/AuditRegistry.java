import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.regex.*;

/**
 * AuditRegistry.java — 登记层对账探针(2026-10-08,一次性排查产物)
 *
 * 回答一个问题:文档/台账里**登记的对象**与**实库里真实存在的对象**,差集在哪一边?
 *   四个登记源两两对账:
 *     ① tools/db-inuse-tables.txt          台账(在册表)
 *     ② docs/development/数据库表清单.md   全库表+视图逐张登记
 *     ③ 实库 sys.objects (U=表 / V=视图, is_ms_shipped=0)
 *     ④ tools/db-migrations.txt           迁移链清单
 *
 * 用法(在 tools 目录下,两个账套各跑一次):
 *   java -cp lib\mssql-jdbc.jar archive\_registry-audit-20261008\AuditRegistry.java HSDZ_MES
 *
 * 判定:「真缺失」= 实库有而登记无(漏登记) 或 登记有而实库无(登记悬空/已删未注销)。
 * 只读,不改任何东西。
 */
public class AuditRegistry {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path tools = Path.of(System.getProperty("user.dir"));
        Path root = tools.getParent();

        // ---------- ① 台账 ----------
        List<String> ledgerLines = Files.readAllLines(tools.resolve("db-inuse-tables.txt"), StandardCharsets.UTF_8);
        Set<String> ledger = new TreeSet<>();
        for (String l : ledgerLines) {
            String t = l.trim();
            if (!t.startsWith("table:")) continue;
            t = t.substring(6);
            int h = t.indexOf('#');            // 台账行格式:table:<表名>   # 中文说明
            if (h >= 0) t = t.substring(0, h);
            t = t.trim();
            if (!t.isEmpty()) ledger.add(t);
        }

        // ---------- ② 表清单文档 ----------
        Path doc = root.resolve("docs/development/数据库表清单.md");
        List<String> docLines = Files.readAllLines(doc, StandardCharsets.UTF_8);
        Set<String> docTables = new TreeSet<>();
        Set<String> docViews = new TreeSet<>();
        boolean inViewSection = false;
        Pattern row = Pattern.compile("^\\|\\s*`([A-Za-z_][A-Za-z0-9_]*)`\\s*\\|");
        for (String l : docLines) {
            if (l.startsWith("## 附:视图清单")) inViewSection = true;
            if (l.startsWith("## 维护记录")) inViewSection = false;
            Matcher m = row.matcher(l);
            if (m.find()) {
                String n = m.group(1);
                if (n.endsWith("_")) continue; // §0 前缀规范行(`yj_` / `bd_` / `wo_` …)—— 不是表名
                (inViewSection ? docViews : docTables).add(n);
            }
        }

        // ---------- ③ 实库 ----------
        Set<String> dbTables = new TreeSet<>(), dbViews = new TreeSet<>();
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, USER, PASS)) {
            System.out.println("=== 库 " + db + " ===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT name, RTRIM(type) AS ty FROM sys.objects WHERE is_ms_shipped=0 AND type IN ('U','V')")) {
                while (rs.next()) {
                    // ⚠ sys.objects.type 是 char(2) 定长 —— 不 RTRIM 会得到 "U " 且 equals("U") 恒假
                    if ("U".equals(rs.getString("ty"))) dbTables.add(rs.getString("name"));
                    else dbViews.add(rs.getString("name"));
                }
            }

            System.out.println("表: 实库 " + dbTables.size() + " / 台账 " + ledger.size() + " / 表清单 " + docTables.size());
            System.out.println("视图: 实库 " + dbViews.size() + " / 表清单 " + docViews.size());
            System.out.println();

            section("实库有、台账未登记(漏登记)", minus(dbTables, ledger));
            section("台账已登记、实库没有(登记悬空)", minus(ledger, dbTables));
            section("实库有、表清单(表段)未登记(漏登记)", minus(dbTables, docTables));
            section("表清单(表段)已登记、实库没有(文档悬空)", minus(docTables, dbTables));
            section("实库有、表清单(视图段)未登记", minus(dbViews, docViews));
            section("表清单(视图段)已登记、实库没有", minus(docViews, dbViews));

            // ---------- ④ 退场脚本的声明是否属实(是否来料检验 = 计算列?) ----------
            System.out.println("=== 声明核验:migrate-inv-inspection-default-no.sql 退场理由 ===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT c.name, c.is_computed, cc.definition, t.name AS tab "
                   + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
                   + "LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id "
                   + "WHERE c.name LIKE N'%来料检验%'")) {
                boolean any = false;
                while (rs.next()) {
                    any = true;
                    System.out.printf("  %s.%s  is_computed=%s  def=%s%n", rs.getString("tab"), rs.getString("name"),
                            rs.getBoolean("is_computed"), rs.getString("definition"));
                }
                if (!any) System.out.println("  [!] 全库无「*来料检验*」列 —— 退场理由不成立,需重新排查");
            }

            // ---------- ⑤ 仓位体系实况(本轮改动的对象) ----------
            System.out.println();
            System.out.println("=== 本轮改动对象实况 ===");
            q(c, "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bs_wh')", "bs_wh 列数");
            q(c, "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('bs_wh_loc')", "bs_wh_loc 列数");
            q(c, "SELECT COUNT(*) FROM bs_wh", "bs_wh 行数");
            q(c, "SELECT COUNT(*) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'')<>'Y'", "bs_wh_loc 有效仓位");
            q(c, "SELECT COUNT(*) FROM yj_schema_log", "yj_schema_log 登记数");
            q(c, "SELECT COUNT(*) FROM yj_field", "yj_field 字段数");
            q(c, "SELECT COUNT(*) FROM yj_panel", "yj_panel 面板数");
            q(c, "SELECT COUNT(*) FROM yj_translation", "yj_translation 译名数");

            System.out.println();
            System.out.println("--- bs_wh(仓库)---");
            dump(c, "SELECT 仓库编码, 仓库名称, 厂区, 仓库分类 FROM bs_wh ORDER BY 仓库编码");
        }
    }

    static void q(Connection c, String sql, String label) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            System.out.println("  " + label + ": " + (rs.next() ? rs.getObject(1) : "?"));
        } catch (SQLException e) {
            System.out.println("  " + label + ": [查询失败] " + e.getMessage().split("\n")[0]);
        }
    }

    static void dump(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= md.getColumnCount(); i++) h.append(md.getColumnLabel(i)).append(i < md.getColumnCount() ? " | " : "");
            System.out.println("  " + h);
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= md.getColumnCount(); i++) b.append(rs.getString(i)).append(i < md.getColumnCount() ? " | " : "");
                System.out.println("  " + b);
            }
        } catch (SQLException e) {
            System.out.println("  [查询失败] " + e.getMessage().split("\n")[0]);
        }
    }

    static Set<String> minus(Set<String> a, Set<String> b) {
        Set<String> r = new TreeSet<>(a);
        r.removeAll(b);
        return r;
    }

    static void section(String title, Set<String> items) {
        System.out.println("[" + title + "] " + items.size() + " 个");
        for (String s : items) System.out.println("    " + s);
    }
}
