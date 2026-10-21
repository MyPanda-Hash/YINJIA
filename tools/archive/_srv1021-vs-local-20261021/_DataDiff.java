import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;
import java.util.*;

/**
 * 逐表数据对比(只读):同实例两个库,行数 + 行级双向 EXCEPT。
 *
 * 用法: java _DataDiff.java <库A> <库B> [--only-diff]
 *   A = 服务器备份还原库(HSDZ_MES_SRV1021, "服务器")
 *   B = 本地库(HSDZ_MES, "本地")
 *
 * 口径:
 *   rowsA/rowsB   两库各自行数
 *   onlyA         在 A 有、B 没有的行(服务器新增 / 本地缺失)
 *   onlyB         在 B 有、A 没有的行(本地新增 / 服务器缺失)
 *   *Rows 列里 <-- 表示两侧不一致
 *
 * 所有列统一 CONVERT 成 nvarchar 再 EXCEPT —— 避免两库同名列类型不同(datetime vs datetime2 等)
 * 导致 EXCEPT 报错;日期用 style 121 保毫秒,binary 用 style 2 转十六进制。
 * text/ntext/image 一并转掉(否则 EXCEPT 不支持)。
 */
public class _DataDiff {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static PrintStream out;
    static final Set<String> DATE_TYPES = new HashSet<>(Arrays.asList(
            "datetime", "datetime2", "smalldatetime", "date", "time", "datetimeoffset"));

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String dbA = a[0], dbB = a[1];
        boolean onlyDiff = a.length > 2 && a[2].equals("--only-diff");

        try (Connection c = DriverManager.getConnection(String.format(BASE, "master"), "sa", "Yinjia@2026")) {
            Map<String, LinkedHashMap<String, String>> colsA = columns(c, dbA);  // table -> (col -> type)
            Map<String, LinkedHashMap<String, String>> colsB = columns(c, dbB);

            TreeSet<String> tables = new TreeSet<>(colsA.keySet());
            tables.addAll(colsB.keySet());

            out.println("库A(服务器)=" + dbA + "   库B(本地)=" + dbB);
            out.printf("%-42s %9s %9s %9s %9s  %s%n", "表", "rowsA", "rowsB", "onlyA", "onlyB", "说明");

            long totA = 0, totB = 0, totOnlyA = 0, totOnlyB = 0;
            List<String[]> diff = new ArrayList<>();
            for (String t : tables) {
                LinkedHashMap<String, String> ca = colsA.get(t), cb = colsB.get(t);
                if (ca == null || cb == null) {
                    out.printf("%-42s %9s %9s %9s %9s  %s%n", t, ca == null ? "-" : "?", cb == null ? "-" : "?",
                            "", "", ca == null ? "仅本地存在(服务器无此表)" : "仅服务器存在(本地无此表)");
                    continue;
                }
                // 公共列(两库都有的列),顺序按 B 的列序
                List<String> common = new ArrayList<>();
                List<String> onlyColsA = new ArrayList<>(), onlyColsB = new ArrayList<>();
                for (String col : cb.keySet()) if (ca.containsKey(col)) common.add(col); else onlyColsB.add(col);
                for (String col : ca.keySet()) if (!cb.containsKey(col)) onlyColsA.add(col);

                long ra = count(c, dbA, t), rb = count(c, dbB, t);
                totA += ra; totB += rb;
                long oa = 0, ob = 0;
                String note = "";
                if (common.isEmpty()) { note = "无公共列,跳过行级比对"; }
                else {
                    String selA = selectList(ca, common, dbA, t), selB = selectList(cb, common, dbB, t);
                    oa = exceptCount(c, "SELECT " + selA + " FROM [" + dbA + "].dbo." + q(t)
                            + " EXCEPT SELECT " + selB + " FROM [" + dbB + "].dbo." + q(t));
                    ob = exceptCount(c, "SELECT " + selB + " FROM [" + dbB + "].dbo." + q(t)
                            + " EXCEPT SELECT " + selA + " FROM [" + dbA + "].dbo." + q(t));
                }
                totOnlyA += oa; totOnlyB += ob;
                if (!onlyColsA.isEmpty()) note += "服务器独有列:" + onlyColsA + " ";
                if (!onlyColsB.isEmpty()) note += "本地独有列:" + onlyColsB + " ";
                boolean changed = (ra != rb || oa != 0 || ob != 0 || !note.isEmpty());
                if (changed) diff.add(new String[]{t, "" + ra, "" + rb, "" + oa, "" + ob, note.trim()});
                if (!onlyDiff || changed) {
                    out.printf("%-42s %9d %9d %9d %9d  %s%s%n", t, ra, rb, oa, ob,
                            (ra != rb || oa != 0 || ob != 0) ? "<-- " : "", note);
                }
            }
            out.println();
            out.println("合计行数: A(服务器)=" + totA + "  B(本地)=" + totB + "  差=" + (totB - totA)
                    + " | 仅服务器行=" + totOnlyA + "  仅本地行=" + totOnlyB);
            out.println("有差异的表 " + diff.size() + " 张");
            out.println("RESULT: DONE");
        }
    }

    static String q(String id) { return "[" + id.replace("]", "]]") + "]"; }

    /** 每列 CONVERT 成 nvarchar,避免跨库同名不同型导致 EXCEPT 失败;列一律给别名(派生表要列名)。 */
    static String selectList(LinkedHashMap<String, String> cols, List<String> common, String db, String table) {
        StringBuilder sb = new StringBuilder();
        int idx = 0;
        for (String col : common) {
            if (sb.length() > 0) sb.append(", ");
            String ty = cols.get(col).toLowerCase(Locale.ROOT);
            String expr;
            if (DATE_TYPES.contains(ty)) expr = "CONVERT(nvarchar(50), " + q(col) + ", 121)";
            else if (ty.equals("image") || ty.equals("binary") || ty.equals("varbinary") || ty.equals("timestamp"))
                expr = "CONVERT(varchar(max), " + q(col) + ", 2)";
            else expr = "CONVERT(nvarchar(max), " + q(col) + ")";
            // NULL 与空串要区分开,否则两库 NULL/'' 差异会被吞掉
            sb.append("CASE WHEN ").append(q(col)).append(" IS NULL THEN N'\\0NULL' ELSE ").append(expr)
              .append(" END AS c").append(++idx);
        }
        return sb.toString();
    }

    static long count(Connection c, String db, String t) {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT_BIG(*) FROM [" + db + "].dbo." + q(t))) {
            return rs.next() ? rs.getLong(1) : -1;
        } catch (SQLException e) { return -2; }
    }

    static long exceptCount(Connection c, String sql) {
        try (Statement st = c.createStatement()) {
            st.setQueryTimeout(1800);
            try (ResultSet rs = st.executeQuery("SELECT COUNT_BIG(*) FROM (" + sql + ") x")) {
                return rs.next() ? rs.getLong(1) : -1;
            }
        } catch (SQLException e) {
            out.println("   [EXCEPT-ERR] " + e.getMessage());
            return -3;
        }
    }

    /** table -> (column -> type),只取用户表 */
    static Map<String, LinkedHashMap<String, String>> columns(Connection c, String db) throws SQLException {
        Map<String, LinkedHashMap<String, String>> m = new TreeMap<>();
        String sql = "SELECT t.name AS tbl, c.name AS col, ty.name AS ty FROM [" + db + "].sys.tables t "
                + "JOIN [" + db + "].sys.columns c ON c.object_id = t.object_id "
                + "JOIN [" + db + "].sys.types ty ON ty.user_type_id = c.user_type_id "
                + "WHERE t.is_ms_shipped = 0 ORDER BY t.name, c.column_id";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                m.computeIfAbsent(rs.getString(1), k -> new LinkedHashMap<>())
                 .put(rs.getString(2), rs.getString(3));
            }
        }
        return m;
    }
}
