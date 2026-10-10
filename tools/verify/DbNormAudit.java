import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * YINJIA-MES 数据库规范体检(只读;规范见 docs/development/数据库规范.md)。
 *
 * 用法(在 tools 目录下执行,与 DbSync 同口径):
 *   java -cp lib/mssql-jdbc.jar verify/DbNormAudit.java                # 体检正式库 HSDZ_MES
 *   set YINJIA_SQL_DB=HSDZ_MES_TEST & java -cp lib/mssql-jdbc.jar verify/DbNormAudit.java
 *   set YINJIA_SQL_PASS=<库口令>                                       # 必填(本工具不内置口令)
 *
 * 读取:
 *   db-legacy-whitelist.txt   冻结/豁免登记(table:/panel:/col:/dupkey:)
 *   db-migrations.txt         迁移链清单(链卫生检查)
 *
 * 判定:
 *   [FAIL] 违规 => 阻断(退出码 1);[WARN] 收敛指标(不阻断)。
 *   最后一行固定输出 RESULT: PASS 或 RESULT: FAIL-n(供脚本判定,纯 ASCII)。
 */
public class DbNormAudit {

    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    /** 口令一律由环境变量传入(不在仓库内置默认值 —— 规范:密码不入库)。 */
    static final String PASS = System.getenv("YINJIA_SQL_PASS");

    static final Map<String, Set<String>> WL = new LinkedHashMap<>();
    static int failCount = 0, warnCount = 0;
    /** 可选:dump=<路径> —— 把 03 项的完整违规清单(table|col|已有中文标签)写出,供据实补注明。 */
    static String dumpPath = null;

    public static void main(String[] args) throws Exception {
        for (String a : args) if (a.startsWith("dump=")) dumpPath = a.substring(5);
        Path base = Path.of(System.getProperty("user.dir"));
        Path wlFile = base.resolve("db-legacy-whitelist.txt");
        Path manifest = base.resolve("db-migrations.txt");
        if (Files.exists(wlFile)) {
            for (String line : Files.readAllLines(wlFile, StandardCharsets.UTF_8)) {
                // 只剥行尾的 CR(CRLF 检出),**不 trim 值** —— 白名单里存在带尾空格的列名/标签
                // (如 col:bd_sale_out.ivc_status 、skiplabel:ivc_status ),trim 会让它们永远匹配不上
                String t = line.endsWith("\r") ? line.substring(0, line.length() - 1) : line;
                if (t.isBlank() || t.startsWith("#")) continue;
                int i = t.indexOf(':');
                if (i <= 0) continue;
                WL.computeIfAbsent(t.substring(0, i).trim(), k -> new LinkedHashSet<>()).add(t.substring(i + 1));
            }
        } else {
            System.out.println("[提示] 未找到 db-legacy-whitelist.txt,豁免清单为空");
        }
        if (PASS == null || PASS.isEmpty()) {
            System.err.println("[FATAL] 未设置环境变量 YINJIA_SQL_PASS(本工具不内置口令)");
            System.exit(2);
        }

        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("=== 数据库规范体检 @ " + c.getCatalog() + " ===");
            System.out.println("(豁免登记:" + wlSummary() + ")");
            System.out.println();

            check01TableNaming(c);
            check02TableComments(c);
            check03ColumnComments(c);
            check04RequiredColumns(c);
            check05MetaDrift(c);
            check06PanelTargets(c);
            check07DuplicateFields(c);
            check08MultiLabelColumns(c);
            check09I18n(c);
            check10BackupTables(c);
            check11IndexPolicy(c);
            check12Chain(base, manifest);
            check13PanelObjectCols(c);

            System.out.println();
            System.out.println("=== 汇总: FAIL " + failCount + " / WARN " + warnCount + " ===");
            System.out.println(failCount == 0 ? "RESULT: PASS" : "RESULT: FAIL-" + failCount);
            System.exit(failCount == 0 ? 0 : 1);
        } catch (Exception e) {
            System.err.println("[FATAL] " + e.getMessage());
            System.exit(2);
        }
    }

    // ---------- 输出助手 ----------
    static void result(boolean fail, String id, String name, int bad, String detail) {
        if (bad == 0) {
            System.out.printf("[PASS] %s %s%n", id, name);
            return;
        }
        if (fail) failCount++; else warnCount++;
        System.out.printf("[%s] %s %s —— %d 处%n", fail ? "FAIL" : "WARN", id, name, bad);
        if (detail != null && !detail.isEmpty()) {
            for (String l : detail.split("\n")) if (!l.isBlank()) System.out.println("        " + l);
        }
    }

    static String wlSummary() {
        StringBuilder sb = new StringBuilder();
        for (var e : WL.entrySet()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(e.getKey()).append(' ').append(e.getValue().size());
        }
        return sb.length() == 0 ? "无" : sb.toString();
    }

    /** 存量债棘轮:白名单里的 count:<检查号>=<基线>。实际值只许降不许升 ——
     *  等于基线记 WARN(收敛指标),超过基线记 FAIL(新债),降到 0 记 PASS。 */
    static void ratchet(String id, String name, int actual, String detail) {
        int base = 0;
        for (String v : wl("count")) {
            if (v.startsWith(id + "=")) {
                try { base = Integer.parseInt(v.substring(id.length() + 1).trim()); } catch (NumberFormatException ignored) { }
            }
        }
        if (actual == 0) {
            System.out.printf("[PASS] %s %s%n", id, name);
            return;
        }
        if (actual > base) {
            failCount++;
            System.out.printf("[FAIL] %s %s —— 实际 %d,超过存量基线 %d(棘轮:只许降不许升)%n", id, name, actual, base);
            if (detail != null && !detail.isEmpty()) {
                for (String l : detail.split("\n")) if (!l.isBlank()) System.out.println("        " + l);
            }
        } else {
            warnCount++;
            System.out.printf("[WARN] %s %s —— 实际 %d / 基线 %d%s%n", id, name, actual, base,
                    actual < base ? "(较基线已降 " + (base - actual) + ")" : "");
        }
    }

    static Set<String> wl(String kind) { return WL.getOrDefault(kind, Set.of()); }

    /** SQL IN 列表(白名单值自带中文/特殊字符,统一转义单引号) */
    static String inList(Set<String> vals) {
        StringBuilder sb = new StringBuilder();
        for (String v : vals) {
            if (sb.length() > 0) sb.append(',');
            sb.append('N').append('\'').append(v.replace("'", "''")).append('\'');
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    static boolean isBackup(String name) {
        String n = name.toLowerCase();
        return n.contains("bak") || n.startsWith("rename") || n.startsWith("tmp") || n.matches("t\\d");
    }

    static boolean isBusiness(String name) {
        for (String p : new String[] { "bd_", "bl_", "bs_", "rd_", "qc_", "wo_" }) {
            if (name.startsWith(p)) return true;
        }
        return false;
    }

    static boolean isCjk(String s) {
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) > 0x2E7F) return true;
        return false;
    }

    // ---------- 检查项 ----------
    /** 01 表命名:白名单之外的表必须用规范前缀 */
    static void check01TableNaming(Connection c) throws Exception {
        Set<String> legal = Set.of("yj_", "bs_", "bd_", "bl_", "rd_", "qc_", "wo_");
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT name FROM sys.tables ORDER BY name")) {
            while (rs.next()) {
                String n = rs.getString(1);
                if (isBackup(n) || wl("table").contains(n)) continue;
                boolean ok = false;
                for (String p : legal) if (n.startsWith(p)) { ok = true; break; }
                if (!ok) bad.add(n);
            }
        }
        result(true, "01", "表命名合规(白名单外)", bad.size(), join(bad, 12));
    }

    /** 02 表级中文注明 */
    static void check02TableComments(Connection c) throws Exception {
        String sql = """
            SELECT t.name FROM sys.tables t
            WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                              WHERE ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description')
            ORDER BY t.name""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String n = rs.getString(1);
                if (isBackup(n) || wl("table").contains(n)) continue;
                bad.add(n);
            }
        }
        result(true, "02", "表级中文注明(白名单外)", bad.size(), join(bad, 12));
    }

    /** 03 列级中文注明:只对拼音/英文列名的列要求(中文列名即语义,豁免)
     *  传 dump=<路径> 时把完整违规清单写成 table|col|已有中文标签(供"据实补注明"使用)。 */
    static void check03ColumnComments(Connection c) throws Exception {
        String sql = """
            SELECT t.name, c.name, ISNULL(f.label, '') FROM sys.columns c
            JOIN sys.tables t ON t.object_id = c.object_id
            LEFT JOIN (SELECT col_name, MIN(label) AS label FROM yj_field WHERE LEN(label) > 0 GROUP BY col_name) f
                   ON f.col_name = c.name
            WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                              WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description')
            ORDER BY t.name, c.column_id""";
        List<String> bad = new ArrayList<>();
        List<String> dump = new ArrayList<>();
        int asciiTotal = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String t = rs.getString(1), col = rs.getString(2), label = rs.getString(3);
                if (isBackup(t) || wl("table").contains(t)) continue;
                if (col.startsWith("asp_")) continue;          // 审计列:语义由规范统一约定
                if (col.equalsIgnoreCase("id")) continue;      // 自增主键:语义由规范统一约定
                if (isCjk(col)) continue;                      // 中文列名即语义
                asciiTotal++;
                bad.add(t + "." + col);
                dump.add(t + "|" + col + "|" + label);
            }
        }
        if (dumpPath != null && !dumpPath.isEmpty()) {
            Files.write(Path.of(dumpPath), dump, StandardCharsets.UTF_8);
            System.out.println("        (完整清单已写出 " + dumpPath + "," + dump.size() + " 行)");
        }
        ratchet("03", "拼音/英文列名的列注明(共 " + asciiTotal + " 列;存量收敛)", bad.size(), join(bad, 12));
    }

    /** 04 业务表必备:主键 + 审计四件套 */
    static void check04RequiredColumns(Connection c) throws Exception {
        String sql = """
            SELECT t.name FROM sys.tables t
            WHERE (t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%' OR t.name LIKE 'bs[_]%'
                OR t.name LIKE 'rd[_]%' OR t.name LIKE 'qc[_]%' OR t.name LIKE 'wo[_]%')
              AND (NOT EXISTS (SELECT 1 FROM sys.indexes i WHERE i.object_id = t.object_id AND i.is_primary_key = 1)
                OR COL_LENGTH(t.name, 'asp_user1') IS NULL OR COL_LENGTH(t.name, 'asp_user2') IS NULL
                OR COL_LENGTH(t.name, 'asp_time1') IS NULL OR COL_LENGTH(t.name, 'asp_time2') IS NULL)
            ORDER BY t.name""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String n = rs.getString(1);
                if (isBackup(n) || wl("table").contains(n)) continue;  // 备份表由 10 号项收敛,不算结构违规
                bad.add(n);
            }
        }
        result(true, "04", "业务表主键与审计四件套", bad.size(), join(bad, 12));
    }

    /** 05 元数据漂移:字段必须存在于「按 place 决定的那个对象」。
     *  口径(2026-09-28 修正 —— 此前把 head/line 当"任一命中即通过",漏判明细面板):
     *    · place 含 header 且 head_table 非空 → 必须存在于 head_table
     *    · 否则 place 含 detail → 必须存在于 line_table
     *    · 仅 query(既无 header 也无 detail)→ head_table 或 line_table 任一即可
     *  为什么较真:明细报表面板的取数 SQL 只 FROM line_table,那里缺列 = 该面板打开即 500。 */
    static void check05MetaDrift(Connection c) throws Exception {
        String sql = """
            SELECT RTRIM(f.panel_code), f.col_name, RTRIM(f.place), ISNULL(p.line_table,''), ISNULL(p.head_table,'')
            FROM yj_field f LEFT JOIN yj_panel p ON RTRIM(p.panel_code) = RTRIM(f.panel_code)
            WHERE f.col_name IS NOT NULL
            ORDER BY 1, f.seq""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String panel = rs.getString(1), col = rs.getString(2), place = rs.getString(3);
                String line = rs.getString(4), head = rs.getString(5);
                if (wl("panel").contains(panel)) continue;
                boolean hasHeader = place.contains("header") && !head.isEmpty();
                boolean hasDetail = place.contains("detail");
                boolean ok;
                if (hasHeader) ok = hasCol(c, head, col);
                else if (hasDetail) ok = hasCol(c, line, col);
                else ok = hasCol(c, line, col) || hasCol(c, head, col);
                if (!ok) bad.add(panel + "." + col + "(" + place + " → " + (hasHeader ? head : line) + ")");
            }
        }
        result(true, "05", "元数据漂移(字段不在其所在对象里)", bad.size(), join(bad, 12));
    }

    /** 对象里是否存在该列(表或视图均可;COL_LENGTH 对两者都有效) */
    static boolean hasCol(Connection c, String object, String col) {
        if (object == null || object.isEmpty() || col == null || col.isEmpty()) return false;
        try (var ps = c.prepareStatement("SELECT 1 AS x WHERE COL_LENGTH(?, ?) IS NOT NULL")) {
            ps.setString(1, object); ps.setString(2, col);
            try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
        } catch (Exception e) { return false; }
    }

    /** 13 面板引用对象的必备列:引擎统一拼 `SELECT t.<pk_col> AS __id … WHERE ISNULL(t.asp_cancel,'N')<>'Y'`,
     *  所以 line_table 必须同时具备 pk_col 与 asp_cancel,否则该面板一打开就 500(2026-09-28 实测 4 例)。 */
    static void check13PanelObjectCols(Connection c) throws Exception {
        String sql = """
            SELECT RTRIM(panel_code), line_table, ISNULL(pk_col,'') FROM yj_panel
            WHERE line_table IS NOT NULL AND OBJECT_ID(line_table) IS NOT NULL
            ORDER BY 1""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String panel = rs.getString(1), line = rs.getString(2), pk = rs.getString(3);
                if (wl("panel").contains(panel)) continue;
                List<String> miss = new ArrayList<>();
                if (!pk.isEmpty() && !hasCol(c, line, pk)) miss.add(pk);
                if (!hasCol(c, line, "asp_cancel")) miss.add("asp_cancel");
                if (!miss.isEmpty()) bad.add(panel + " → " + line + " 缺 " + String.join("+", miss));
            }
        }
        result(true, "13", "面板引用对象缺 pk_col / asp_cancel(打开即 500)", bad.size(), join(bad, 12));
    }

    /** 06 面板指向不存在对象 */
    static void check06PanelTargets(Connection c) throws Exception {
        String sql = """
            SELECT RTRIM(panel_code), ISNULL(line_table,'') + ' / ' + ISNULL(head_table,'') FROM yj_panel
            WHERE (line_table IS NOT NULL AND OBJECT_ID(line_table) IS NULL)
               OR (head_table IS NOT NULL AND OBJECT_ID(head_table) IS NULL)
            ORDER BY 1""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                if (wl("panel").contains(rs.getString(1))) continue;
                bad.add(rs.getString(1) + " → " + rs.getString(2));
            }
        }
        result(true, "06", "面板指向不存在的表/视图", bad.size(), join(bad, 12));
    }

    /** 07 完全重复的字段行(同面板/列/place/seq) */
    static void check07DuplicateFields(Connection c) throws Exception {
        String sql = """
            SELECT RTRIM(panel_code) + '.' + col_name + ' (' + RTRIM(place) + ',seq ' + CAST(seq AS varchar) + ')'
            FROM yj_field GROUP BY RTRIM(panel_code), col_name, RTRIM(place), seq
            HAVING COUNT(*) > 1 ORDER BY 1""";
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                if (wl("panel").contains(rs.getString(1).split("\\.")[0])) continue;
                bad.add(rs.getString(1));
            }
        }
        result(true, "07", "完全重复的字段登记行", bad.size(), join(bad, 12));
    }

    /** 08 同一物理列挂多个中文标签(数据键不唯一)⇒ 告警,已登记的不计 */
    static void check08MultiLabelColumns(Connection c) throws Exception {
        String sql = """
            SELECT DISTINCT RTRIM(f.panel_code) + '.' + f.col_name FROM yj_field f
            WHERE EXISTS (SELECT 1 FROM yj_field k
                          WHERE RTRIM(k.panel_code) = RTRIM(f.panel_code) AND k.col_name = f.col_name
                            AND k.id <> f.id AND RTRIM(k.place) <> RTRIM(f.place))
            ORDER BY 1""";
        List<String> bad = new ArrayList<>();
        int known = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String k = rs.getString(1);
                if (wl("dupkey").contains(k)) { known++; continue; }
                bad.add(k);
            }
        }
        result(false, "08", "同一列多标签(数据键不唯一;已登记 " + known + " 组)", bad.size(), join(bad, 12));
    }

    /** 09 多语言 en 覆盖(规范:新面板/新字段缺 en = 功能未完成) */
    static void check09I18n(Connection c) throws Exception {
        String sqlQ = """
            SELECT COUNT(*) FROM yj_panel p WHERE NOT EXISTS (
              SELECT 1 FROM yj_translation t WHERE t.scope = 'panel' AND t.ref_key = RTRIM(p.panel_name) AND t.locale = 'en')""";
        String sqlF = """
            SELECT f.label FROM yj_field f WHERE NOT EXISTS (
              SELECT 1 FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = f.label AND t.locale = 'en')
            GROUP BY f.label""";
        int q;
        Set<String> missing = new LinkedHashSet<>();
        try (Statement st = c.createStatement()) {
            q = scalar(st, sqlQ);
            try (ResultSet rs = st.executeQuery(sqlF)) {
                while (rs.next()) {
                    String label = rs.getString(1);
                    if (wl("skiplabel").contains(label)) continue;   // 免译标签登记(本身即英文/单位/编号)
                    missing.add(label);
                }
            }
        }
        int f = missing.size();
        ratchet("09", "缺 en 译名(面板 " + q + " / 字段标签 " + f + ")", q + f,
                "面板缺: " + q + " 个;字段标签缺: " + f + " 个"
                        + (f > 0 ? "\n" + join(new ArrayList<>(missing), 12) : "")
                        + "\n补齐:tools/scripts/trigger-mt.ps1;免译标签登记见 §5");
    }

    /** 10 备份/临时表(收敛指标:应逐步清零) */
    static void check10BackupTables(Connection c) throws Exception {
        List<String> bad = new ArrayList<>();
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT name FROM sys.tables ORDER BY name")) {
            while (rs.next()) if (isBackup(rs.getString(1))) bad.add(rs.getString(1));
        }
        ratchet("10", "备份/临时表(应清零)", bad.size(), join(bad, 6));
    }

    /** 11 索引策略:大表(≥10 万行)必须有主键之外的索引
     *  注意:用 sys.partitions(不需 VIEW DATABASE STATE);sys.dm_db_partition_stats 在正式库会被
     *  yinjia 账号拒绝(实测 2026-09-28:权限不足直接打死进程)。 */
    static void check11IndexPolicy(Connection c) throws Exception {
        // 大表清单(行数取自 sys.partitions,不需 VIEW DATABASE STATE 权限)
        List<String> big = new ArrayList<>();
        String sql = """
            SELECT t.name, SUM(p.rows) AS rc
            FROM sys.partitions p JOIN sys.tables t ON t.object_id = p.object_id
            WHERE p.index_id IN (0,1)
            GROUP BY t.name
            HAVING SUM(p.rows) >= 100000
            ORDER BY 2 DESC""";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) big.add(rs.getString(1) + " → " + rs.getLong(2) + " 行");
        }
        // 逐张看有没有主键之外的非聚集索引(type=2)
        List<String> bad = new ArrayList<>();
        for (String b : big) {
            String name = b.split(" → ")[0];
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID("
                         + q(name) + ") AND type = 2")) {
                if (rs.next() && rs.getInt(1) == 0) bad.add(b);
            }
        }
        result(true, "11", "≥10 万行且无非聚集索引的表(现存 " + big.size() + " 张大表)", bad.size(), join(bad, 12));
    }

    static String q(String s) { return "N'" + s.replace("'", "''") + "'"; }

    /** 12 迁移链卫生:清单 ↔ tools/*.sql 一一对应 */
    static void check12Chain(Path base, Path manifest) throws Exception {
        if (!Files.exists(manifest)) { result(true, "12", "迁移链清单", 1, "未找到 " + manifest); return; }
        List<String> listed = new ArrayList<>();
        for (String line : Files.readAllLines(manifest, StandardCharsets.UTF_8)) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("#")) listed.add(t);
        }
        Set<String> onDisk = new TreeSet<>();
        try (var s = Files.list(base)) {
            s.filter(p -> p.getFileName().toString().endsWith(".sql"))
             .forEach(p -> onDisk.add(p.getFileName().toString()));
        }
        // 工具类脚本允许不在链上(人工维护白名单,见规范 §4)
        // ⚠ 第二类:**手动回滚/撤回工具** —— 有意不进链,因为一登记 DbSync 就会执行它。
        //   migrate-wo-process-line-drop.sql(2026-10-06):用户当时口径「不应该预排产」⇒ DROP wo_process_line;
        //   但 2026-10-07 又以「人工逐道选线」口径**恢复**了该表(migrate-wo-process-line.sql 头部写明
        //   「该脚本不在迁移链里,手动执行」)。若登记,DbSync 会立刻把线上正在用的表删掉 ⇒ 只能链外。
        //   migrate-field-multiline-text-rollback-20261015.sql(2026-10-15):「多行文本」字段类型的**回滚**,
        //   把三面板 21 行的 data_type 从 多行文本 改回 文本。若登记,DbSync 会在链尾自动把功能关掉。
        Set<String> allowOffChain = Set.of("check-migrations.sql", "deploy-all.sql", "dump-schema-log.sql",
                "dump-server-views.sql", "fix-db-logins.sql", "migrate-golive-cleanup.sql", "migrate-rd-cleanup.sql",
                "migrate-table-comments.sql", "migrate-testdata-cleanup.sql", "restore-from-backup.sql",
                "restore-local-bak.sql", "seed-demo-prodfile.sql",
                "migrate-wo-process-line-drop.sql",
                "migrate-field-multiline-text-rollback-20261015.sql");
        List<String> bad = new ArrayList<>();
        for (String f : onDisk) {
            if (listed.contains(f) || allowOffChain.contains(f) || f.startsWith("_")) continue;
            bad.add("未登记的脚本: " + f);
        }
        for (String l : listed) if (!Files.exists(base.resolve(l))) bad.add("清单缺文件: " + l);
        result(true, "12", "迁移链清单 ↔ 文件一致(清单 " + listed.size() + " / 文件 " + onDisk.size() + ")", bad.size(), join(bad, 12));
    }

    // ---------- 工具 ----------
    static int scalar(Statement st, String sql) throws Exception {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? rs.getInt(1) : 0; }
    }

    static String join(List<String> items, int max) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size() && i < max; i++) {
            if (i > 0) sb.append('\n');
            sb.append(items.get(i));
        }
        if (items.size() > max) sb.append("\n…(还有 ").append(items.size() - max).append(" 项)");
        return sb.toString();
    }
}
