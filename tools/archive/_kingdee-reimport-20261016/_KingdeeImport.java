import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * _KingdeeImport.java — 把 tools/archive/_dump-out/kingdee-data-1014 的 CSV 导回 MES 库(幂等)
 *
 * 由来:2026-10-16 用户「把这个数据导进来」——这批 CSV 是从正式库 SELECT * 导出的金蝶同步单据
 * (8 类单据头/行 + 暂收/检验链路 9 表 + yj_doc_status 留痕),本地两账套这些表几乎全空,要补回。
 *
 * 口径:
 *   · **以「单据」为单位幂等**(不是逐行):目标表里已存在该「业务键」的行 ⇒ 该单整单跳过(头表+线路表同一口径),
 *     业务键 = 头/线路表的 `单据编号`、yj_doc_status 的 (panel_code, doc_no)、
 *     qc_insp_req 的 (物料类别, 物料编号)、plang 的 `pl_no`、form_flow_link 无业务键(本地为空,按 id);
 *     ⇒ 本地已有同号单时**绝不插第二份**,避免界面出现两张同号单或明细翻倍;
 *   · `id` 作为第二道闸:CSV 的 id 已存在也跳过;
 *   · CSV 里比目标表多的列(如 yj_doc_status 的「派生状态」)自动忽略并报告;
 *   · 空单元格 ⇒ NULL;数值/日期按目标列 JDBC 类型转换,转换失败的行**不插入**并点名(退出码 1)。
 *
 * 用法(在 tools 目录下):
 *   java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar archive\_kingdee-reimport-20261016\_KingdeeImport.java <csvDir> [--apply] [--only 表1,表2]
 * 默认 dry-run(只读+报告,不写库);加 --apply 才写。库用 YINJIA_SQL_DB 覆盖(默认 HSDZ_MES)。
 */
public class _KingdeeImport {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final int BATCH = 200;

    static boolean apply = false;
    static Set<String> only = null;

    static class Col {
        String name; int type; int size; boolean nullable; boolean identity; boolean hasDefault;
    }

    static class Stat {
        int csvRows, insert, skipId, skipDoc, bad;
        int newDocs, skipDocs;
        Set<String> newDocSet = new LinkedHashSet<>();
        Set<String> skipDocSet = new LinkedHashSet<>();
        List<Long> insertedIds = new ArrayList<>();
        List<String> insertedKeys = new ArrayList<>();   // yj_doc_status 这类「CSV 没有 id」的表,按业务键回滚
        List<String> notes = new ArrayList<>();
    }

    public static void main(String[] args) throws Exception {
        Path dir = null;
        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--apply")) apply = true;
            else if (args[i].equals("--only")) only = new HashSet<>(Arrays.asList(args[++i].split(",")));
            else dir = Path.of(args[i]);
        }
        if (dir == null) { System.err.println("用法: _KingdeeImport.java <csvDir> [--apply] [--only t1,t2]"); System.exit(2); }

        List<Path> files = new ArrayList<>();
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, "*.csv")) { for (Path p : ds) files.add(p); }
        files.sort(Comparator.comparing(p -> p.getFileName().toString()));

        System.out.println((apply ? "=== 导入(写库) " : "=== DRY-RUN(只读,不写库) ") + DB + " ← " + dir + " ===");
        int totRows = 0, totIns = 0, totSkip = 0, totSkipDoc = 0, totBad = 0, tables = 0;
        LinkedHashMap<String, List<Long>> inserted = new LinkedHashMap<>();
        LinkedHashMap<String, List<String>> insertedByKey = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            c.setAutoCommit(false);
            for (Path f : files) {
                String table = f.getFileName().toString().replaceAll("\\.csv$", "");
                if (only != null && !only.contains(table)) continue;
                if (objectId(c, table) == null) { System.out.println("[跳过] 表不存在: " + table); continue; }
                tables++;
                Stat st = doTable(c, f, table);
                totRows += st.csvRows; totIns += st.insert; totSkip += st.skipId; totSkipDoc += st.skipDoc; totBad += st.bad;
                if (!st.insertedIds.isEmpty()) inserted.put(table, st.insertedIds);
                if (!st.insertedKeys.isEmpty()) insertedByKey.put(table, st.insertedKeys);
            }
            c.rollback(); // dry-run 模式下没有任何写入;apply 模式下每个表已各自 commit
        }
        System.out.println("\n=== 合计:表 " + tables + " 张 / CSV " + totRows + " 行 ⇒ 新增 " + totIns
                + " / 跳过(该单已在本地) " + totSkipDoc + " / 跳过(id 已存在) " + totSkip + " / 转换失败 " + totBad + " ===");
        if (apply && (!inserted.isEmpty() || !insertedByKey.isEmpty())) writeRollback(inserted, insertedByKey);
        if (!apply) System.out.println("[提示] 这是 DRY-RUN,一个字节都没写库;确认后加 --apply 重跑。");
        System.exit(totBad > 0 ? 1 : 0);
    }

    /** 写出精确回滚脚本:能按 id 的按 id 逐表 DELETE;CSV 没有 id 的表(yj_doc_status)按业务键 DELETE(身份自增,不能靠 id 猜) */
    static void writeRollback(Map<String, List<Long>> inserted, Map<String, List<String>> insertedByKey) throws Exception {
        Path out = Path.of("archive", "_kingdee-reimport-20261016", "rollback-" + DB + ".sql");
        StringBuilder sb = new StringBuilder();
        sb.append("/* rollback-").append(DB).append(".sql — 撤销 ").append(DB)
          .append(" 上本次金蝶数据导入插入的行(按被插入的 id 精确删除)\n")
          .append("   生成:tools/archive/_kingdee-reimport-20261016/_KingdeeImport.java --apply\n")
          .append("   用法:同导入,cd tools;java \"-Dstdout.encoding=UTF-8\" -cp lib\\mssql-jdbc.jar DbSync.java run archive\\_kingdee-reimport-20261016\\rollback-")
          .append(DB).append(".sql  ⚠ 该路径不在迁移清单里(不要登记)\n*/\nSET NOCOUNT ON;\n");
        int total = 0;
        for (Map.Entry<String, List<Long>> e : inserted.entrySet()) {
            List<Long> ids = e.getValue();
            total += ids.size();
            sb.append("DELETE FROM [").append(e.getKey()).append("] WHERE id IN (")
              .append(ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","))).append(");\n");
        }
        sb.append("PRINT N'rollback 完成:按 id 撤销 ").append(total).append(" 行';\n");
        for (Map.Entry<String, List<String>> e : insertedByKey.entrySet()) {
            List<String> keys = e.getValue();
            sb.append("-- ").append(e.getKey()).append(":CSV 无 id,按业务键逐行 DELETE(").append(keys.size()).append(" 行)\n");
            for (String k : keys) {
                String[] p = k.split("\u0001", -1);
                sb.append("DELETE FROM [").append(e.getKey()).append("] WHERE panel_code = N'")
                  .append(p[0].replace("'", "''")).append("' AND doc_no = N'").append(p[1].replace("'", "''")).append("';\n");
            }
        }
        sb.append("PRINT N'rollback 完成';\n");
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[回滚脚本] " + out + "(" + total + " 行 id,逐表 DELETE)");
    }

    static Long objectId(Connection c, String table) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT OBJECT_ID(?)")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getLong(1); }
        }
    }

    static Stat doTable(Connection c, Path csv, String table) throws SQLException, Exception {
        Stat st = new Stat();
        List<String[]> rows = readCsv(csv);
        if (rows.isEmpty()) { System.out.println("[空文件] " + table); return st; }
        String[] header = rows.get(0);
        st.csvRows = rows.size() - 1;

        // 目标表列
        LinkedHashMap<String, Col> cols = tableCols(c, table);
        List<Col> use = new ArrayList<>();
        List<String> dropped = new ArrayList<>();
        for (String h : header) {
            Col col = cols.get(h);
            if (col != null) use.add(col); else dropped.add(h);
        }
        // NOT NULL 且无默认值、又不在 CSV 里的列 ⇒ 插入会失败,先点名
        List<String> needAbsent = new ArrayList<>();
        for (Col col : cols.values()) {
            if (!col.nullable && !col.hasDefault && !col.identity && indexOf(header, col.name) < 0 && !isComputedSkippable(col.name))
                needAbsent.add(col.name);
        }

        boolean identityIncluded = false;
        for (Col col : use) if (col.identity) identityIncluded = true;

        // ── 幂等:① 业务键(单据)口径 ② id 兜底 ──
        String[] keyCols = keyCols(table, cols);
        Set<String> localIds = new HashSet<>();
        Set<String> localDocKeys = new HashSet<>();
        try (Statement s = c.createStatement()) {
            try (ResultSet rs = s.executeQuery("SELECT id FROM [" + table + "]")) {
                while (rs.next()) localIds.add(String.valueOf(rs.getLong(1)).trim());
            }
            if (keyCols != null) {
                String kSel = String.join(",", Arrays.stream(keyCols).map(x -> "[" + x + "]").toArray(String[]::new));
                try (ResultSet rs = s.executeQuery("SELECT " + kSel + " FROM [" + table + "]")) {
                    while (rs.next()) {
                        StringBuilder sb = new StringBuilder();
                        for (int i = 1; i <= keyCols.length; i++) sb.append(rs.getString(i)).append('\u0001');
                        localDocKeys.add(sb.toString());
                    }
                }
            }
        }
        int[] keyIdx = keyCols == null ? null : Arrays.stream(keyCols).mapToInt(k -> indexOf(header, k)).toArray();

        int iId = indexOf(header, "id");
        List<String[]> toInsert = new ArrayList<>();
        for (int r = 1; r < rows.size(); r++) {
            String[] row = pad(rows.get(r), header.length);
            String id = val(row, iId);
            String docKey = null;
            if (keyIdx != null) {
                StringBuilder sb = new StringBuilder();
                for (int k : keyIdx) sb.append(val(row, k)).append('\u0001');
                docKey = sb.toString();
            }
            if (docKey != null && localDocKeys.contains(docKey)) {   // 整单已在本地 ⇒ 跳过(不插第二份)
                st.skipDoc++;
                st.skipDocSet.add(docKey.replace('\u0001', '|'));
                continue;
            }
            if (!id.isEmpty() && localIds.contains(id)) { st.skipId++; continue; }
            if (docKey != null) { st.newDocSet.add(docKey.replace('\u0001', '|')); if (table.equals("yj_doc_status")) st.insertedKeys.add(docKey); }
            toInsert.add(row);
        }
        st.skipDocs = st.skipDocSet.size();
        st.newDocs = st.newDocSet.size();

        System.out.println("== " + table + " ==");
        System.out.println("   CSV " + st.csvRows + " 行 / 列 " + use.size() + "(" + cols.size() + " 列中"
                + (dropped.isEmpty() ? "" : ",忽略 " + dropped) + ")");
        System.out.println("   业务键 " + (keyCols == null ? "(无,只按 id)" : String.join("+", keyCols))
                + " ⇒ 新增 " + toInsert.size() + " 行 / " + (keyCols == null ? "-" : st.newDocs + " 个键")
                + " | 跳过(该单已在本地) " + st.skipDoc + " 行 / " + st.skipDocs + " 个键"
                + " | 跳过(id 已存在) " + st.skipId + " | 转换失败 " + st.bad
                + (identityIncluded ? " | 保留自增 id" : ""));
        if (!needAbsent.isEmpty()) System.out.println("   ⚠ 目标表有 NOT NULL 无默认值且 CSV 没有的列: " + needAbsent);
        if (st.skipDocs > 0 && st.skipDocs <= 8) System.out.println("   已在本地: " + st.skipDocSet);
        if (st.newDocs > 0 && st.newDocs <= 8) System.out.println("   将新增: " + st.newDocSet);
        for (String n : st.notes) System.out.println("   · " + n);

        if (!apply || toInsert.isEmpty()) { st.insert = toInsert.size(); return st; }

        String colList = String.join(",", use.stream().map(x -> "[" + x.name + "]").toArray(String[]::new));
        String qs = String.join(",", Collections.nCopies(use.size(), "?"));
        try (Statement s = c.createStatement(); PreparedStatement ps = c.prepareStatement("INSERT INTO [" + table + "] (" + colList + ") VALUES (" + qs + ")")) {
            if (identityIncluded) s.execute("SET IDENTITY_INSERT [" + table + "] ON");
            int n = 0, bad = 0;
            for (String[] row : toInsert) {
                ps.clearParameters();
                boolean ok = true;
                for (int k = 0; k < use.size(); k++) {
                    Col col = use.get(k);
                    String raw = val(row, indexOf(header, col.name));
                    try {
                        setValue(ps, k + 1, col, raw);
                    } catch (Exception e) {
                        ok = false; bad++;
                        if (bad <= 5) System.out.println("   ! 转换失败 " + col.name + "=" + raw + " : " + e.getMessage());
                        break;
                    }
                }
                if (!ok) continue;
                long rid = 0;
                try { rid = Long.parseLong(val(row, iId).trim()); } catch (Exception ignore) {}
                if (rid > 0) st.insertedIds.add(rid);
                ps.addBatch();
                if (++n % BATCH == 0) ps.executeBatch();
            }
            int[] res = ps.executeBatch();
            st.insert = n;
            if (identityIncluded) s.execute("SET IDENTITY_INSERT [" + table + "] OFF");
            if (bad > 0) { st.bad += bad; c.rollback(); System.out.println("   [回滚] 转换失败 " + bad + " 行,该表整体未写入"); st.insert = 0; st.insertedIds.clear(); }
            else c.commit();
        }
        return st;
    }

    /** 生成列清单(含 identity / 默认值),键为列名 */
    static LinkedHashMap<String, Col> tableCols(Connection c, String table) throws SQLException {
        LinkedHashMap<String, Col> out = new LinkedHashMap<>();
        String sql = "SELECT c.name, c.is_identity, c.is_nullable, c.default_object_id, "
                + "ty.name AS tname, c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id "
                + "WHERE c.object_id = OBJECT_ID(?) ORDER BY c.column_id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Col col = new Col();
                    col.name = rs.getString("name");
                    col.identity = rs.getBoolean("is_identity");
                    col.nullable = rs.getBoolean("is_nullable");
                    col.hasDefault = rs.getInt("default_object_id") != 0;
                    col.size = rs.getInt("max_length");
                    out.put(col.name, col);
                }
            }
        }
        // JDBC 类型从结果集元数据取(与驱动转换口径一致)
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT * FROM [" + table + "] WHERE 1=0")) {
            ResultSetMetaData md = rs.getMetaData();
            for (int i = 1; i <= md.getColumnCount(); i++) {
                Col col = out.get(md.getColumnLabel(i));
                if (col != null) { col.type = md.getColumnType(i); if (col.size <= 0) col.size = md.getColumnDisplaySize(i); }
            }
        }
        return out;
    }

    static boolean isComputedSkippable(String name) { return false; }

    /** 各表的「单据」业务键(整单幂等用);返回 null = 本地无同键概念,只按 id 去重 */
    static String[] keyCols(String table, Map<String, Col> cols) {
        if (table.equals("yj_doc_status")) return new String[]{"panel_code", "doc_no"};
        if (table.equals("qc_insp_req")) return new String[]{"物料类别", "物料编号"};
        if (table.equals("plang")) return cols.containsKey("pl_no") ? new String[]{"pl_no"} : null;
        if (table.equals("form_flow_link")) return null;   // 本地为空,按 id
        if (cols.containsKey("单据编号")) return new String[]{"单据编号"};
        return null;
    }

    static void setValue(PreparedStatement ps, int idx, Col col, String raw) throws SQLException {
        String s = raw == null ? null : raw.trim();
        boolean empty = (s == null || s.isEmpty());
        switch (col.type) {
            case Types.INTEGER: case Types.BIGINT: case Types.SMALLINT: case Types.TINYINT:
            case Types.DECIMAL: case Types.NUMERIC: case Types.FLOAT: case Types.REAL: case Types.DOUBLE:
                if (empty) { ps.setNull(idx, col.type); return; }
                ps.setBigDecimal(idx, new BigDecimal(s.replace(",", "")));
                return;
            case Types.BIT: case Types.BOOLEAN:
                if (empty) { ps.setNull(idx, Types.BIT); return; }
                String t = s.toLowerCase(Locale.ROOT);
                ps.setBoolean(idx, t.equals("1") || t.equals("true") || t.equals("y"));
                return;
            case Types.DATE:
                if (empty) { ps.setNull(idx, Types.DATE); return; }
                ps.setDate(idx, java.sql.Date.valueOf(parseLdt(s).toLocalDate()));
                return;
            case Types.TIME:
                if (empty) { ps.setNull(idx, Types.TIME); return; }
                ps.setTime(idx, java.sql.Time.valueOf(parseLdt(s).toLocalTime()));
                return;
            case Types.TIMESTAMP: case Types.TIMESTAMP_WITH_TIMEZONE:
                if (empty) { ps.setNull(idx, Types.TIMESTAMP); return; }
                ps.setTimestamp(idx, Timestamp.valueOf(parseLdt(s)));
                return;
            default:
                if (empty) { ps.setNull(idx, Types.NVARCHAR); return; }
                ps.setString(idx, raw);
        }
    }

    static LocalDateTime parseLdt(String in) {
        String s = in.trim().replace('T', ' ');
        if (s.endsWith("Z")) s = s.substring(0, s.length() - 1);
        if (s.matches(".*[+-]\\d{2}:?\\d{2}$")) s = s.substring(0, s.length() - 6).trim();
        String[] p = s.split(" +");
        LocalDate d = LocalDate.parse(p[0]);
        LocalTime t = LocalTime.MIN;
        if (p.length > 1 && !p[1].isEmpty()) {
            String ts = p[1];
            if (ts.length() == 5) ts = ts + ":00";
            t = LocalTime.parse(ts);
        }
        return LocalDateTime.of(d, t);
    }

    static int indexOf(String[] arr, String v) {
        for (int i = 0; i < arr.length; i++) if (arr[i].trim().equals(v)) return i;
        return -1;
    }

    static String val(String[] row, int idx) {
        if (idx < 0 || idx >= row.length || row[idx] == null) return "";
        return row[idx];
    }

    static String[] pad(String[] row, int n) {
        if (row.length == n) return row;
        String[] out = new String[n];
        Arrays.fill(out, "");
        System.arraycopy(row, 0, out, 0, Math.min(row.length, n));
        return out;
    }

    /** 极简 RFC4180 解析:支持双引号包裹与 "" 转义 */
    static List<String[]> readCsv(Path f) throws Exception {
        String text = Files.readString(f, StandardCharsets.UTF_8);
        if (!text.isEmpty() && text.codePointAt(0) == 0xFEFF) text = text.substring(1);
        List<String[]> out = new ArrayList<>();
        List<String> cur = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean q = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (q) {
                if (ch == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { sb.append('"'); i++; }
                    else q = false;
                } else sb.append(ch);
            } else if (ch == '"') q = true;
            else if (ch == ',') { cur.add(sb.toString()); sb.setLength(0); }
            else if (ch == '\r') { /* skip */ }
            else if (ch == '\n') { cur.add(sb.toString()); sb.setLength(0); out.add(cur.toArray(new String[0])); cur.clear(); }
            else sb.append(ch);
        }
        if (sb.length() > 0 || !cur.isEmpty()) { cur.add(sb.toString()); out.add(cur.toArray(new String[0])); }
        return out;
    }
}
