import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;
import java.util.*;

/**
 * 行级差异下钻(只读,多重集口径):按业务键分组后逐行比对两个库。
 *
 * 用法: java _RowDiff.java <库A> <库B> <表> <键列|PK> [--max N] [--cols 列1,列2]
 *   A = 服务器备份库(HSDZ_MES_SRV1021,"服务器")   B = 本地库(HSDZ_MES,"本地")
 *
 * ⚠ 为什么不能只按 id 建 Map:本库多张表(bl_so_order / form_flow_link / s_allno …)
 *   的 id 并不唯一(BI 导入会复用 id),单键 Map 会把重复行"压成一行",导致
 *   行数差与值差互相矛盾。这里改成 key -> 该键下的多行(排序后的行签名列表)。
 *
 * 输出:
 *   ① 仅 A / 仅 B 的键(整行都不存在)
 *   ② 同键但行数不同(重复行增删或改键)
 *   ③ 同键同行数但内容不同 -> 逐列 服务器值 -> 本地值
 *
 * 所有列统一 CONVERT 成 nvarchar 再比,规避两库同名不同型(float vs nvarchar、datetime vs datetime2)。
 */
public class _RowDiff {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final Set<String> DATE_TYPES = new HashSet<>(Arrays.asList(
            "datetime", "datetime2", "smalldatetime", "date", "time", "datetimeoffset"));
    static PrintStream out;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String dbA = a[0], dbB = a[1], table = a[2];
        int max = 20;
        Set<String> onlyCols = null;
        String keySpec = a[3];
        for (int i = 4; i < a.length; i++) {
            if (a[i].equals("--max")) max = Integer.parseInt(a[++i]);
            else if (a[i].equals("--cols")) onlyCols = new HashSet<>(Arrays.asList(a[++i].split(",")));
        }

        try (Connection c = DriverManager.getConnection(String.format(BASE, "master"), "sa", "Yinjia@2026")) {
            List<String> keys = keySpec.equals("PK") ? pkCols(c, dbB, table) : Arrays.asList(keySpec.split(","));
            if (keys.isEmpty()) { out.println("[ERR] 无可用键"); return; }
            LinkedHashMap<String, String> ca = cols(c, dbA, table);
            LinkedHashMap<String, String> cb = cols(c, dbB, table);
            if (ca.isEmpty() || cb.isEmpty()) {
                out.println("[ERR] 表不存在: " + table + " A列=" + ca.size() + " B列=" + cb.size());
                return;
            }
            List<String> common = new ArrayList<>();
            List<String> onlyA = new ArrayList<>(), onlyB = new ArrayList<>();
            for (String col : cb.keySet()) { if (ca.containsKey(col)) common.add(col); else onlyB.add(col); }
            for (String col : ca.keySet()) if (!cb.containsKey(col)) onlyA.add(col);

            List<String> cmp = new ArrayList<>();
            for (String col : common) {
                if (keys.contains(col)) continue;
                if (onlyCols == null || onlyCols.contains(col)) cmp.add(col);
            }
            List<String> show = displayCols(common, keys);

            out.println("== 表 " + table + " ==");
            out.println("公共列 " + common.size() + "  键 " + keys + "  比对列 " + cmp.size());
            if (!onlyA.isEmpty()) out.println("服务器独有列: " + onlyA);
            if (!onlyB.isEmpty()) out.println("本地独有列:   " + onlyB);

            Map<String, List<Map<String, String>>> ra = fetch(c, dbA, table, common, ca, keys);
            Map<String, List<Map<String, String>>> rb = fetch(c, dbB, table, common, cb, keys);
            int rowsA = sum(ra), rowsB = sum(rb);
            out.println("行数: 服务器=" + rowsA + "  本地=" + rowsB + "  键数: " + ra.size() + "/" + rb.size());

            out.println("\n---- ① 仅A(键只在服务器) ----");
            int n = printOnly(ra, rb, show, max);
            if (n == 0) out.println("   (无)");

            out.println("\n---- ② 仅B(键只在本地) ----");
            n = printOnly(rb, ra, show, max);
            if (n == 0) out.println("   (无)");

            out.println("\n---- ③ 同键内容不同 ----");
            int shown = 0, diffKeys = 0, diffRowsTotal = 0, cntMismatch = 0;
            Map<String, Integer> colHits = new TreeMap<>();
            for (String k : new TreeSet<>(ra.keySet())) {
                List<Map<String, String>> x = ra.get(k), y = rb.get(k);
                if (y == null) continue;
                if (x.size() != y.size()) {
                    cntMismatch++;
                    if (shown < max) {
                        out.println("   " + k + "  行数 " + x.size() + " -> " + y.size()
                                + "   [" + preview(x.get(0), show) + "]");
                    }
                    diffKeys++;
                    continue;
                }
                List<Map<String, String>> xs = sorted(x, cmp), ys = sorted(y, cmp);
                for (int i = 0; i < xs.size(); i++) {
                    List<String> diffs = new ArrayList<>();
                    for (String col : cmp) {
                        String va = xs.get(i).get(col), vb = ys.get(i).get(col);
                        if (!eq(va, vb)) { diffs.add(col + ": " + dash(va) + " -> " + dash(vb)); colHits.merge(col, 1, Integer::sum); }
                    }
                    if (diffs.isEmpty()) continue;
                    diffRowsTotal++;
                    if (shown++ < max) {
                        out.println("   " + k + "   [" + preview(xs.get(i), show) + "]");
                        for (String d : diffs) out.println("        " + d);
                    }
                }
            }
            out.println("   同键行数不同(重复行/改键)=" + cntMismatch + " 键;  内容不同的行=" + diffRowsTotal);
            if (shown > max) out.println("   (上面只列了前 " + max + " 行)");
            out.println("   按列统计(命中行数): " + colHits);
            out.println("RESULT: DONE");
        }
    }

    static String dash(String v) { return v == null ? "<NULL>" : (v.isEmpty() ? "<空串>" : v); }

    static boolean eq(String a, String b) { return a == null ? b == null : a.equals(b); }

    static int sum(Map<String, List<Map<String, String>>> m) {
        int n = 0; for (List<Map<String, String>> v : m.values()) n += v.size(); return n;
    }

    static List<Map<String, String>> sorted(List<Map<String, String>> rows, List<String> cmp) {
        List<Map<String, String>> copy = new ArrayList<>(rows);
        copy.sort(Comparator.comparing(r -> sig(r, cmp)));
        return copy;
    }

    static String sig(Map<String, String> row, List<String> cmp) {
        StringBuilder sb = new StringBuilder();
        for (String col : cmp) sb.append(row.get(col)).append('\u0001');
        return sb.toString();
    }

    static String preview(Map<String, String> row, List<String> show) {
        StringBuilder sb = new StringBuilder();
        for (String col : show) {
            String v = row.get(col);
            if (v == null) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append(col).append('=').append(v.length() > 34 ? v.substring(0, 34) + "…" : v);
        }
        return sb.toString();
    }

    static int printOnly(Map<String, List<Map<String, String>>> a, Map<String, List<Map<String, String>>> b,
                         List<String> show, int max) {
        int n = 0, total = 0;
        for (String k : new TreeSet<>(a.keySet())) {
            if (b.containsKey(k)) continue;
            total++;
            if (n++ >= max) continue;
            for (Map<String, String> row : a.get(k)) out.println("   " + k + "   [" + preview(row, show) + "]");
        }
        if (total > max) out.println("   ...(共 " + total + " 个键,已截断)");
        return total;
    }

    static String q(String id) { return "[" + id.replace("]", "]]") + "]"; }

    static String conv(String col, String ty) {
        String t = ty == null ? "" : ty.toLowerCase(Locale.ROOT);
        if (DATE_TYPES.contains(t)) return "CONVERT(nvarchar(50), " + q(col) + ", 121)";
        if (t.equals("image") || t.equals("binary") || t.equals("varbinary") || t.equals("timestamp"))
            return "CONVERT(varchar(max), " + q(col) + ", 2)";
        return "CONVERT(nvarchar(max), " + q(col) + ")";
    }

    /** key -> 该键下的多行 */
    static Map<String, List<Map<String, String>>> fetch(Connection c, String db, String table,
            List<String> common, LinkedHashMap<String, String> types, List<String> keys) throws SQLException {
        StringBuilder sel = new StringBuilder();
        for (String col : common) {
            if (sel.length() > 0) sel.append(", ");
            sel.append(conv(col, types.get(col)));
        }
        String sql = "SELECT " + sel + " FROM [" + db + "].dbo." + q(table);
        Map<String, List<Map<String, String>>> m = new LinkedHashMap<>();
        try (Statement st = c.createStatement()) {
            st.setFetchSize(5000);
            st.setQueryTimeout(1800);
            try (ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) {
                    Map<String, String> row = new LinkedHashMap<>();
                    StringBuilder kb = new StringBuilder();
                    for (int i = 0; i < common.size(); i++) {
                        String col = common.get(i);
                        String v = rs.getString(i + 1);
                        row.put(col, v);
                        if (keys.contains(col)) {
                            if (kb.length() > 0) kb.append("~");
                            kb.append(v == null ? "<NULL>" : v);
                        }
                    }
                    m.computeIfAbsent(kb.toString(), k -> new ArrayList<>()).add(row);
                }
            }
        }
        return m;
    }

    static LinkedHashMap<String, String> cols(Connection c, String db, String table) {
        LinkedHashMap<String, String> m = new LinkedHashMap<>();
        String sql = "SELECT c.name, ty.name FROM [" + db + "].sys.columns c "
                + "JOIN [" + db + "].sys.tables t ON t.object_id=c.object_id "
                + "JOIN [" + db + "].sys.types ty ON ty.user_type_id=c.user_type_id "
                + "WHERE t.name = ? ORDER BY c.column_id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) m.put(rs.getString(1), rs.getString(2)); }
        } catch (SQLException e) { out.println("[ERR cols] " + e.getMessage()); }
        return m;
    }

    /** 取建库B的主键列(键=PK 时自动)。 */
    static List<String> pkCols(Connection c, String db, String table) {
        List<String> ks = new ArrayList<>();
        String sql = "SELECT col.name FROM [" + db + "].sys.indexes i "
                + "JOIN [" + db + "].sys.tables t ON t.object_id=i.object_id "
                + "JOIN [" + db + "].sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id "
                + "JOIN [" + db + "].sys.columns col ON col.object_id=ic.object_id AND col.column_id=ic.column_id "
                + "WHERE t.name = ? AND i.is_primary_key = 1 AND ic.is_included_column = 0 "
                + "ORDER BY ic.key_ordinal";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) { while (rs.next()) ks.add(rs.getString(1)); }
        } catch (SQLException e) { out.println("[ERR pk] " + e.getMessage()); }
        return ks;
    }

    /** 展示列:优先业务可读列,便于肉眼定位是哪张单。 */
    static List<String> displayCols(List<String> common, List<String> keys) {
        List<String> pref = Arrays.asList("单据编号", "单号", "工单号", "存货编码", "产品编码", "物料编码",
                "form_no", "doc_no", "panel_code", "名称", "物料名称", "form_name", "order_no");
        List<String> show = new ArrayList<>();
        for (String p : pref) if (common.contains(p)) show.add(p);
        for (String k : keys) if (!show.contains(k)) show.add(k);
        if (show.isEmpty()) show.add(common.get(0));
        return show;
    }
}
