import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * 一次性工具:两个库的**完整**结构对比(只读),输出不截断、按类归并,直接写 UTF-8 报告文件。
 * 与 tools/DbSchemaDiff.java 的区别:
 *   ① 不截断(那边 缺 40 / 多 20 就砍);
 *   ② 列差异按「表.列」配对,区分「仅参考库有 / 仅目标库有 / 同名但定义不同」——后者才是真·结构冲突;
 *   ③ 面板字段差异按面板分组统计;
 *   ④ 报告写文件(UTF-8),绕开 Windows 控制台 GBK 乱码。
 *
 * 用法: java -cp tools/lib/mssql-jdbc.jar tools/archive/_DbStructDiff2.java <参考库URL> <目标库URL> <用户> <密码> <报告文件>
 */
public class _DbStructDiff2 {

    static final String Q_TABLES =
        "SELECT CONCAT(s.name, '.', t.name) FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id";
    static final String Q_VIEWS =
        "SELECT CONCAT(s.name, '.', v.name) FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id";
    static final String Q_COLUMNS =
        "SELECT CONCAT(s.name,'.',t.name) AS tbl, c.name AS col, ty.name AS typ, c.max_length AS len, "
      + "c.is_nullable AS nul, c.is_identity AS ident, c.column_id AS ord "
      + "FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id "
      + "JOIN sys.schemas s ON s.schema_id = t.schema_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id";
    static final String Q_PANELS = "SELECT RTRIM(panel_code) FROM yj_panel";
    static final String Q_FIELDS = "SELECT RTRIM(panel_code) AS p, RTRIM(col_name) AS c FROM yj_field";

    static Connection open(String url, String user, String pass) throws Exception {
        return DriverManager.getConnection(url, user, pass);
    }

    static TreeSet<String> set(Connection c, String sql) throws Exception {
        TreeSet<String> s = new TreeSet<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) s.add(rs.getString(1));
        }
        return s;
    }

    /** 列:key = 表.列 → 定义串 */
    static TreeMap<String, String> cols(Connection c) throws Exception {
        TreeMap<String, String> m = new TreeMap<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(Q_COLUMNS)) {
            while (rs.next()) {
                m.put(rs.getString("tbl") + "." + rs.getString("col"),
                      rs.getString("typ") + "(" + rs.getInt("len") + ")"
                    + (rs.getInt("nul") == 1 ? " NULL" : " NOT NULL")
                    + (rs.getInt("ident") == 1 ? " IDENTITY" : ""));
            }
        }
        return m;
    }

    static TreeSet<String> panelFields(Connection c) throws Exception {
        TreeSet<String> s = new TreeSet<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(Q_FIELDS)) {
            while (rs.next()) s.add(rs.getString("p") + "." + rs.getString("c"));
        }
        return s;
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("用法: _DbStructDiff2 <参考库URL> <目标库URL> <用户> <密码> <报告文件>");
            System.exit(2);
        }
        String refUrl = args[0], tgtUrl = args[1], user = args[2], pass = args[3];
        Path out = Path.of(args[4]);

        TreeSet<String> refT, tgtT, refV, tgtV, refP, tgtP, refF, tgtF;
        TreeMap<String, String> refC, tgtC;
        String refName, tgtName;
        try (Connection c = open(refUrl, user, pass)) {
            refName = c.getCatalog();
            refT = set(c, Q_TABLES); refV = set(c, Q_VIEWS); refP = set(c, Q_PANELS); refF = panelFields(c); refC = cols(c);
        }
        try (Connection c = open(tgtUrl, user, pass)) {
            tgtName = c.getCatalog();
            tgtT = set(c, Q_TABLES); tgtV = set(c, Q_VIEWS); tgtP = set(c, Q_PANELS); tgtF = panelFields(c); tgtC = cols(c);
        }

        int dTables, dViews, dPanels, dFields;
        try (PrintWriter w = new PrintWriter(out.toFile(), StandardCharsets.UTF_8)) {
            w.println("库结构完整对比报告(只读,不截断)");
            w.println("参考库 = " + refName + "   (来自 db\\yjmes2.bak 的还原库)");
            w.println("目标库 = " + tgtName + "   (本机现役库)");
            w.println();

            dTables = sectionSets(w, "1. 表(sys.tables)", refT, tgtT);
            dViews  = sectionSets(w, "3. 视图(sys.views)", refV, tgtV);
            dPanels = sectionSets(w, "4. 面板(yj_panel.panel_code)", refP, tgtP);
            dFields = sectionPanelFields(w, refF, tgtF);

            // ── 2. 列 ──
            w.println("=== 2. 列(sys.columns)===");
            w.println("  参考库共 " + refC.size() + " 列 / 目标库共 " + tgtC.size() + " 列");
            List<String> onlyRef = new ArrayList<>(), onlyTgt = new ArrayList<>(), changed = new ArrayList<>();
            for (Map.Entry<String, String> e : refC.entrySet()) {
                String k = e.getKey();
                if (!tgtC.containsKey(k)) onlyRef.add(k + "  [" + e.getValue() + "]");
                else if (!tgtC.get(k).equals(e.getValue()))
                    changed.add(k + "   参考[" + e.getValue() + "]  vs  目标[" + tgtC.get(k) + "]");
            }
            for (String k : tgtC.keySet()) if (!refC.containsKey(k)) onlyTgt.add(k + "  [" + tgtC.get(k) + "]");

            w.println();
            w.println("-- 2.1 仅参考库有(目标库缺)" + onlyRef.size() + " 列:按表分组 --");
            groupByTable(w, onlyRef);
            w.println();
            w.println("-- 2.1b 仅参考库有:逐列全量 --");
            for (String s : onlyRef) w.println("    [缺] " + s);
            w.println();
            w.println("-- 2.2 仅目标库有(参考库缺)" + onlyTgt.size() + " 列:按表分组 --");
            groupByTable(w, onlyTgt);
            w.println();
            w.println("-- 2.2b 仅目标库有:逐列全量 --");
            for (String s : onlyTgt) w.println("    [多] " + s);
            w.println();
            w.println("-- 2.3 同名但定义不同(类型/长度/可空/自增)" + changed.size() + " 列:逐条 --");
            for (String s : changed) w.println("    [异] " + s);

            // ── 汇总 ──
            w.println();
            w.println("=== 6. 汇总 ===");
            w.println("  表:参考 " + refT.size() + " / 目标 " + tgtT.size() + "  |  仅参考 " + dTables0(refT, tgtT)
                    + "  仅目标 " + dTables0(tgtT, refT));
            w.println("  视图:参考 " + refV.size() + " / 目标 " + tgtV.size() + "  |  仅参考 " + dTables0(refV, tgtV)
                    + "  仅目标 " + dTables0(tgtV, refV));
            w.println("  面板:参考 " + refP.size() + " / 目标 " + tgtP.size() + "  |  仅参考 " + dTables0(refP, tgtP)
                    + "  仅目标 " + dTables0(tgtP, refP));
            w.println("  面板字段:参考 " + refF.size() + " / 目标 " + tgtF.size() + "  |  仅参考 " + dTables0(refF, tgtF)
                    + "  仅目标 " + dTables0(tgtF, refF));
            w.println("  列:仅参考 " + onlyRef.size() + " / 仅目标 " + onlyTgt.size() + " / 定义不同 " + changed.size());
            w.println();
            w.println("  表差异数=" + dTables + " 视图差异数=" + dViews + " 面板差异数=" + dPanels
                    + " 字段差异数=" + dFields
                    + " 列差异数=" + (onlyRef.size() + onlyTgt.size() + changed.size()));
        }
        System.out.println("[OK] 报告已写 " + out.toAbsolutePath());
    }

    static int dTables0(TreeSet<String> a, TreeSet<String> b) {
        TreeSet<String> x = new TreeSet<>(a); x.removeAll(b); return x.size();
    }

    /** 集合类差异:先全量列出,再给按前缀(表名)分组统计 */
    static int sectionSets(PrintWriter w, String title, TreeSet<String> ref, TreeSet<String> tgt) {
        TreeSet<String> onlyRef = new TreeSet<>(ref); onlyRef.removeAll(tgt);
        TreeSet<String> onlyTgt = new TreeSet<>(tgt); onlyTgt.removeAll(ref);
        w.println("=== " + title + " ===");
        w.println("  参考 " + ref.size() + " / 目标 " + tgt.size() + "  |  仅参考 " + onlyRef.size()
                + "  仅目标 " + onlyTgt.size());
        w.println("  -- 仅参考库有(目标库缺)--");
        for (String s : onlyRef) w.println("    [缺] " + s);
        w.println("  -- 仅目标库有(参考库缺)--");
        for (String s : onlyTgt) w.println("    [多] " + s);
        w.println();
        return onlyRef.size() + onlyTgt.size();
    }

    static int sectionPanelFields(PrintWriter w, TreeSet<String> ref, TreeSet<String> tgt) {
        TreeSet<String> onlyRef = new TreeSet<>(ref); onlyRef.removeAll(tgt);
        TreeSet<String> onlyTgt = new TreeSet<>(tgt); onlyTgt.removeAll(ref);
        w.println("=== 5. 面板字段(yj_field:面板.字段名)===");
        w.println("  参考 " + ref.size() + " / 目标 " + tgt.size() + "  |  仅参考 " + onlyRef.size()
                + "  仅目标 " + onlyTgt.size());
        w.println("  按面板统计(仅参考 / 仅目标):");
        TreeMap<String, int[]> by = new TreeMap<>();
        for (String s : onlyRef) by.computeIfAbsent(panel(s), k -> new int[2])[0]++;
        for (String s : onlyTgt) by.computeIfAbsent(panel(s), k -> new int[2])[1]++;
        for (Map.Entry<String, int[]> e : by.entrySet())
            w.println("    " + e.getKey() + "  仅参考 " + e.getValue()[0] + " / 仅目标 " + e.getValue()[1]);
        w.println("  -- 仅参考库有:逐条 --");
        for (String s : onlyRef) w.println("    [缺] " + s);
        w.println("  -- 仅目标库有:逐条 --");
        for (String s : onlyTgt) w.println("    [多] " + s);
        w.println();
        return onlyRef.size() + onlyTgt.size();
    }

    static String panel(String fq) { int i = fq.indexOf('.'); return i < 0 ? fq : fq.substring(0, i); }

    /** 归组:键是 dbo.表.列,按 dbo.表 统计(不能按第一个点切,那样只能得到 schema) */
    static void groupByTable(PrintWriter w, List<String> rows) {
        TreeMap<String, Integer> cnt = new TreeMap<>();
        for (String r : rows) {
            int i = r.lastIndexOf('.');
            String t = i < 0 ? r : r.substring(0, i);
            cnt.merge(t, 1, Integer::sum);
        }
        for (Map.Entry<String, Integer> e : cnt.entrySet())
            w.println("    " + e.getKey() + "  " + e.getValue() + " 列");
    }
}
