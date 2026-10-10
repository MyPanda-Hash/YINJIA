import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * _YjFieldAlign.java — yj_field 元数据「按值」对齐器(只读对比 + 可选产出对齐 SQL)。
 *
 * 为什么要这个:
 *   ① tools/DbSchemaDiff.java 只比 (panel_code, col_name) 的**集合**,比不出「同一字段的
 *      显示名/顺序/位置/参照源/可见性被改过」——而《采购链四单字段与显示字段》这份基线的
 *      全部内容正是这些**属性值**;
 *   ② yj_field 里同一个 (panel_code, col_name) **可以有多行**(同一字段既能出现在查询区又能出现在
 *      明细页签,位置不同 place 不同;甚至完全重复),所以行身份 = (col_name, place),比较必须按
 *      **多重集**做 —— 2026-10-08 实测:漏掉 (QC_RETURN.批次号 query,header) 的 seq 差异、
 *      (PURCHASE_IN.本次结算金额本位币 detail) 在测试库多一行,都是按 col_name 做键造成的盲区。
 *
 * 用法(在 tools 目录):
 *   java -cp lib\mssql-jdbc.jar archive\_YjFieldAlign.java <参考库JDBC> <目标库JDBC> <用户> <密码|env> [面板码,逗号分隔|ALL] [--sql]
 * 例:
 *   java -cp lib\mssql-jdbc.jar archive\_YjFieldAlign.java \
 *     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" \
 *     "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false" yinjia env
 *
 * 输出:[少]/[多]/[改] 三类差异;末尾 RESULT: IDENTICAL 或 RESULT: DIFF-n;
 *       --sql 时额外打印幂等对齐 SQL(UPDATE/DELETE 按目标库 id 定位,保持 id 不变 ⇒ 不影响并列排序;
 *       缺行按参考库取值 INSERT)。
 * 只跑 SELECT,本工具自己不写库。
 */
public class _YjFieldAlign {

    /** 相对比较的属性列(除主键 id 与两个定位列外全比) */
    static final String[] ATTRS = {
        "label", "data_type", "dict_sql", "ref_panel", "ref_field", "display_field",
        "place", "seq", "width", "editable", "required", "hidden", "alias",
        "visible", "label_en", "col_group", "ref_filter", "tab_key",
    };
    /** 会以数字字面量输出的属性 */
    static final TreeSet<String> NUMERIC = new TreeSet<>(List.of("seq", "width", "editable", "required", "hidden", "visible"));

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("用法: _YjFieldAlign <参考库JDBC> <目标库JDBC> <用户> <密码|env> [面板码,逗号分隔|ALL] [--sql]");
            System.exit(2);
        }
        String refUrl = args[0], tgtUrl = args[1], user = args[2];
        String pass = args[3].equals("env") ? System.getenv("YINJIA_SQL_PASS") : args[3];
        String panels = args.length > 4 && !args[4].startsWith("--") ? args[4] : "QC_RECV,QC_INSP,QC_RETURN,PURCHASE_IN";
        boolean emitSql = false;
        for (String a : args) if (a.equals("--sql")) emitSql = true;

        try (Connection ref = DriverManager.getConnection(refUrl, user, pass);
             Connection tgt = DriverManager.getConnection(tgtUrl, user, pass)) {
            String where = "ALL".equalsIgnoreCase(panels)
                ? "" : " WHERE RTRIM(panel_code) IN (" + inList(panels) + ")";
            Map<String, List<Row>> r = load(ref, where, false);   // 参考库:不需要 id
            Map<String, List<Row>> t = load(tgt, where, true);    // 目标库:要 id 好定位
            int rn = r.values().stream().mapToInt(List::size).sum();
            int tn = t.values().stream().mapToInt(List::size).sum();
            System.out.println("[参考库] " + ref.getCatalog() + "  " + rn + " 行");
            System.out.println("[目标库] " + tgt.getCatalog() + "  " + tn + " 行");
            System.out.println("(对比范围: " + ("ALL".equalsIgnoreCase(panels) ? "全部面板" : panels)
                + "; 行身份 = 面板+字段+place; 属性列 " + ATTRS.length + " 个)");
            System.out.println();

            int diff = 0;
            List<String> sql = new ArrayList<>();
            TreeSet<String> keys = new TreeSet<>();
            keys.addAll(r.keySet());
            keys.addAll(t.keySet());

            for (String k : keys) {
                List<Row> ra = new ArrayList<>(r.getOrDefault(k, List.of()));
                List<Row> ta = new ArrayList<>(t.getOrDefault(k, List.of()));
                ra.sort((x, y) -> Integer.compare(x.id, y.id));
                ta.sort((x, y) -> Integer.compare(x.id, y.id));
                String panel = k.substring(0, k.indexOf('|'));
                String col = k.substring(k.indexOf('|') + 1, k.lastIndexOf('|'));
                String place = k.substring(k.lastIndexOf('|') + 1);

                if (ra.size() == ta.size()) {
                    // 数量一致:按 id 顺序两两配对,值不同 → UPDATE(保 id ⇒ 并列排序不受影响)
                    for (int i = 0; i < ra.size(); i++) {
                        List<String> changed = diffOf(ra.get(i), ta.get(i));
                        if (!changed.isEmpty()) {
                            System.out.println("[改] " + panel + "." + col + " (" + place + ")  " + String.join("; ", changed));
                            if (emitSql) sql.add(updateSql(panel, col, place, ra.get(i), changed));
                            diff++;
                        }
                    }
                    continue;
                }
                // 数量不一致:先按「整行内容」多重集削多补少,再把剩余的按 id 顺序配平
                Map<String, Integer> refCount = counts(ra), tgtCount = counts(ta);
                List<Row> tgtLeft = new ArrayList<>();
                for (Row row : ta) {
                    int c = tgtCount.getOrDefault(row.canon, 0);
                    if (c > refCount.getOrDefault(row.canon, 0)) {
                        System.out.println("[多] " + panel + "." + col + " (" + place + ")  id=" + row.id);
                        if (emitSql) sql.add(dupDeleteSql(panel, col, place));
                        diff++;
                        tgtCount.put(row.canon, c - 1);
                    } else {
                        tgtLeft.add(row);
                    }
                }
                List<Row> refLeft = new ArrayList<>();
                for (Row row : ra) {
                    int c = refCount.getOrDefault(row.canon, 0);
                    if (c > tgtCount.getOrDefault(row.canon, 0)) {
                        System.out.println("[少] " + panel + "." + col + " (" + place + ")");
                        if (emitSql) sql.add(insertSql(panel, row));
                        diff++;
                        refCount.put(row.canon, c - 1);
                    } else {
                        refLeft.add(row);
                    }
                }
                for (int i = 0; i < Math.min(refLeft.size(), tgtLeft.size()); i++) {
                    List<String> changed = diffOf(refLeft.get(i), tgtLeft.get(i));
                    if (!changed.isEmpty()) {
                        System.out.println("[改] " + panel + "." + col + " (" + place + ")  " + String.join("; ", changed));
                        if (emitSql) sql.add(updateSql(panel, col, place, refLeft.get(i), changed));
                        diff++;
                    }
                }
            }

            System.out.println();
            if (emitSql && !sql.isEmpty()) {
                System.out.println("--- 对齐 SQL(目标库执行;参考库上为 no-op)---");
                System.out.println("SET NOCOUNT ON;");
                for (String s : sql) System.out.println(s);
                System.out.println("--- 对齐 SQL 结束 ---");
            }
            System.out.println("RESULT: " + (diff == 0 ? "IDENTICAL" : "DIFF-" + diff));
            System.exit(diff == 0 ? 0 : 1);
        }
    }

    static String inList(String panels) {
        StringBuilder sb = new StringBuilder();
        for (String p : panels.split(",")) {
            if (sb.length() > 0) sb.append(',');
            sb.append('\'').append(p.trim().replace("'", "''")).append('\'');
        }
        return sb.toString();
    }

    static class Row {
        int id;
        String col;
        Map<String, String> attrs;
        String canon;
    }

    /** key = panel|col_name|place(行身份);同 key 下按 id 排序的列表 */
    static Map<String, List<Row>> load(Connection c, String where, boolean withId) throws Exception {
        Map<String, List<Row>> out = new TreeMap<>();
        String q = "SELECT " + (withId ? "id, " : "") + "RTRIM(panel_code) AS panel_code, RTRIM(col_name) AS col_name, "
            + String.join(", ", ATTRS) + " FROM yj_field" + where;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(q)) {
            ResultSetMetaData md = rs.getMetaData();
            while (rs.next()) {
                Row row = new Row();
                row.id = withId ? rs.getInt("id") : 0;
                row.col = rs.getString("col_name");
                row.attrs = new LinkedHashMap<>();
                for (String a : ATTRS) {
                    Object v = rs.getObject(colIndex(md, a));
                    row.attrs.put(a, v == null ? null : (v instanceof Boolean ? (((Boolean) v) ? "1" : "0") : String.valueOf(v)));
                }
                StringBuilder canon = new StringBuilder();
                for (String a : ATTRS) canon.append(row.attrs.get(a)).append('\u0001');
                row.canon = canon.toString();
                String key = rs.getString("panel_code") + "|" + rs.getString("col_name") + "|"
                    + (row.attrs.get("place") == null ? "" : row.attrs.get("place"));
                out.computeIfAbsent(key, x -> new ArrayList<>()).add(row);
            }
        }
        return out;
    }

    static Map<String, Integer> counts(List<Row> rows) {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (Row r : rows) m.merge(r.canon, 1, Integer::sum);
        return m;
    }

    /** 属性差异描述(ref → tgt) */
    static List<String> diffOf(Row ref, Row tgt) {
        List<String> out = new ArrayList<>();
        for (String c : ATTRS) {
            String a = ref.attrs.get(c), b = tgt.attrs.get(c);
            if (a == null ? b != null : !a.equals(b)) out.add(c + ": " + show(a) + " -> " + show(b));
        }
        return out;
    }

    static int colIndex(ResultSetMetaData md, String name) throws Exception {
        for (int i = 1; i <= md.getColumnCount(); i++) if (md.getColumnLabel(i).equalsIgnoreCase(name)) return i;
        throw new IllegalStateException("列不存在: " + name);
    }

    static String show(String v) { return v == null ? "NULL" : ("'" + v + "'"); }

    static String lit(String v) { return v == null ? "NULL" : ("N'" + v.replace("'", "''") + "'"); }

    static String val(String col, String v) { return v == null ? "NULL" : (NUMERIC.contains(col) ? v : lit(v)); }

    /**
     * UPDATE 用「面板+字段+place」定位并带上**旧值守卫**,不用 id ——
     * 两个账套的 id 是各自历史产物(同一个 id 在两边可能是不同的字段行),
     * 迁移脚本要在两账套都跑,按 id 定位会误伤正式库。带旧值守卫 ⇒ 正式库上 no-op、可重复执行。
     */
    static String updateSql(String panel, String col, String place, Row ref, List<String> changed) {
        StringBuilder set = new StringBuilder();
        String guardCol = null, guardVal = null;
        for (String ch : changed) {
            String c = ch.substring(0, ch.indexOf(':'));
            if (set.length() > 0) set.append(", ");
            set.append(c).append('=').append(val(c, ref.attrs.get(c)));
            if (guardCol == null) { guardCol = c; guardVal = ref.attrs.get(c); }
        }
        // 守卫取目标库「当前值」:从 diff 串里 "-‑> '旧值'" 反解
        String old = null;
        for (String ch : changed) {
            if (ch.startsWith(guardCol + ":")) {
                String tail = ch.substring(ch.indexOf("-> ") + 3);
                old = tail.equals("NULL") ? null : tail.substring(1, tail.length() - 1);
            }
        }
        return "UPDATE yj_field SET " + set + " WHERE panel_code=" + lit(panel) + " AND col_name=" + lit(col)
            + " AND place=" + lit(place) + " AND " + guardCol + "=" + val(guardCol, old) + ";";
    }

    /** 删掉同 (面板,字段,place) 下多出来的重复行(只留 id 最小的那行);正式库上 no-op */
    static String dupDeleteSql(String panel, String col, String place) {
        String where = "panel_code=" + lit(panel) + " AND col_name=" + lit(col) + " AND place=" + lit(place);
        return "DELETE FROM yj_field WHERE " + where + " AND id NOT IN (SELECT MIN(id) FROM yj_field WHERE " + where + ");";
    }

    static String insertSql(String panel, Row ref) {
        StringBuilder c = new StringBuilder("panel_code, col_name");
        StringBuilder v = new StringBuilder(lit(panel) + ", " + lit(ref.col));
        for (String a : ATTRS) {
            c.append(", ").append(a);
            v.append(", ").append(val(a, ref.attrs.get(a)));
        }
        return "IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=" + lit(panel) + " AND col_name=" + lit(ref.col)
            + " AND place=" + lit(ref.attrs.get("place")) + ") INSERT INTO yj_field (" + c + ") VALUES (" + v + ");";
    }
}
