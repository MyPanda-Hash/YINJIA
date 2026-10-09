import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * FourDocAudit.java — 采购链四单「字段与显示字段」漂移体检(基线 = docs/development/采购链四单字段与显示字段.md)
 *
 * 为什么有它:2026-10-05 迁移链整链重放(79 条脚本因字节变更被 DbSync 判为重跑)把四单 yj_field
 * 整批换成另一代登记 —— 参照源越界回落、QC_RECV 明细少 10 行、QC_INSP「单位」消失、hidden 位被翻开。
 * 当时只能靠人工跑 §8 四步 + git diff 才发现(事故与回正见 tools/migrate-fourdoc-baseline-restore-20261008.sql)。
 * 本工具把这一步变成一条命令:逐面板比对「现役 yj_field」与基线快照,有差异即 FAIL(exit 1)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar verify\FourDocAudit.java            # 查 HSDZ_MES
 *   java -cp lib\mssql-jdbc.jar verify\FourDocAudit.java HSDZ_MES_TEST
 *   java -Dstdout.encoding=UTF-8 ...                                # 想看中文不错行
 *
 * 基线快照:tools/fourdoc-baseline.tsv —— 由 tools/archive/_gen-fourdoc-restore.mjs 生成(与回正脚本同源,
 *   即 2026-10-03 基线 dump 去掉"物理列已不存在"的行 / 退货数量列改名 数量 之后的**当前应然态**)。
 *   改了四单字段(按文档 §7 流程)后,必须重跑生成器刷新快照 + 回正脚本,再重生成文档,三者同批提交。
 *
 * 判定口径(与文档一致):
 *   ① 多出的行(现役有、基线无)    ② 缺失的行(基线有、现役无)    ③ 同键但内容不同的行
 *   ④ 顺序名次不符的行(seq 并列时按 id 升序的名次;只比键唯一的行)
 *   ⑤ 越界污染(§5.3:data_type=参照 且 ref_panel=GFDA 且 标签不含"供应商")必须为 0
 */
public class FourDocAudit {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String[] PANELS = {"QC_RECV", "QC_INSP", "QC_RETURN", "PURCHASE_IN"};

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path base = Path.of(System.getProperty("user.dir"));
        Path tsv = base.resolve("fourdoc-baseline.tsv");
        if (!Files.exists(tsv)) {
            System.err.println("[FATAL] 缺基线快照 tools/fourdoc-baseline.tsv;"
                    + "用 node tools/archive/_gen-fourdoc-restore.mjs 重新生成");
            System.exit(2);
        }
        List<Row> want = readTsv(tsv);
        List<Row> have = readDb(db);

        int bad = 0;
        System.out.println("[库] " + db + "  基线快照 " + tsv.getFileName() + "(" + want.size() + " 行)");
        for (String p : PANELS) {
            List<Row> w = filter(want, p), h = filter(have, p);
            int extra = 0, missing = 0, changed = 0, order = 0;
            for (Row r : h) if (match(w, r) == null) extra++;
            for (Row r : w) if (match(h, r) == null) missing++;
            Map<String, Integer> dupW = dupKeys(w), dupH = dupKeys(h);
            for (Row r : h) {
                Row m = match(w, r);
                if (m != null && !sameContent(m, r)) changed++;
            }
            // 顺序名次:只比「键唯一」的行(基线有 6 对完全重复行,重复键在名次比较里会扇出假差异)
            List<Row> hRank = rank(h), wRank = rank(w);
            Map<String, Integer> rankW = new HashMap<>();
            for (Row r : wRank) if (dupW.getOrDefault(key(r), 0) == 1) rankW.put(key(r), r.rank);
            for (Row r : hRank)
                if (dupH.getOrDefault(key(r), 0) == 1 && rankW.containsKey(key(r)) && rankW.get(key(r)) != r.rank) order++;

            int drift = extra + missing + changed + order;
            bad += drift;
            System.out.printf("  %-12s 现役 %3d 行 / 基线 %3d 行  | 多出 %d · 缺失 %d · 内容变 %d · 名次不符 %d  %s%n",
                    p, h.size(), w.size(), extra, missing, changed, order, drift == 0 ? "✅" : "❌");
            if (drift > 0) {
                printExamples("多出", h, w);
                printExamples("缺失", w, h);
            }
        }
        int pollute = 0;
        try (Connection c = conn(db); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_field WHERE panel_code IN "
                     + "('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN') AND data_type=N'参照' "
                     + "AND ref_panel='GFDA' AND label NOT LIKE N'%供应商%'")) {
            if (rs.next()) pollute = rs.getInt(1);
        }
        System.out.println("  越界污染(非供应商语义却指 GFDA,§5.3 应 0): " + pollute + (pollute == 0 ? " ✅" : " ❌"));
        bad += pollute;

        // ---- 物理列对账:文档(基线 dump 的 COL 段)认定的列,本库在不在 ----------
        bad += checkColumns(db, base);

        if (bad == 0) {
            System.out.println("[PASS] 四单 yj_field 与基线一致(§四 12/12 需另跑文档生成器的核验段)");
        } else {
            System.out.println("[FAIL] 四单偏离基线 " + bad + " 处 —— 按文档 §8 判定「有意改动还是回归」;"
                    + "回归即重跑:YINJIA_SQL_DB=<库> java -cp lib\\mssql-jdbc.jar DbSync.java run migrate-fourdoc-baseline-restore-20261008.sql");
            System.exit(1);
        }
    }

    // ---- 行模型 ----
    static class Row {
        int ord, seq, width, rank;
        String panel, col, label, place, type, flags, alias, refPanel, refField, displayField,
                refFilter, dictSql, labelEn, colGroup;
    }

    /**
     * 物理列对账:文档(基线 dump 的 COL 段 = 生成文档时的 sys.columns)认定的列,本库缺一列即 FAIL。
     * 反向(库里有、文档没有)只提示不判 FAIL —— rebuild 血统带来的列未登记即"界面不显示",属文档自身承认的状态。
     */
    static int checkColumns(String db, Path base) throws Exception {
        Path dump = base.resolve("archive/_dump-out/_head-fields-HSDZ_MES.md");
        if (!Files.exists(dump)) {
            System.out.println("  物理列对账: 跳过(缺基线 dump " + dump + ")");
            return 0;
        }
        Map<String, Set<String>> want = new LinkedHashMap<>();
        for (String ln : Files.readAllLines(dump, StandardCharsets.UTF_8)) {
            String[] t = ln.split("\t");
            if (t.length > 2 && t[0].equals("COL"))
                want.computeIfAbsent(t[1], k -> new LinkedHashSet<>()).add(t[2]);
        }
        int missing = 0, extraTotal = 0;
        System.out.println("  物理列对账(文档认定的表列 vs 本库):");
        try (Connection c = conn(db)) {
            for (Map.Entry<String, Set<String>> e : want.entrySet()) {
                Set<String> have = new LinkedHashSet<>();
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT column_name FROM information_schema.columns WHERE table_name=?")) {
                    ps.setString(1, e.getKey());
                    try (ResultSet rs = ps.executeQuery()) { while (rs.next()) have.add(rs.getString(1)); }
                }
                List<String> miss = new ArrayList<>(), ext = new ArrayList<>();
                for (String x : e.getValue()) if (!have.contains(x)) miss.add(x);
                for (String x : have) if (!e.getValue().contains(x)) ext.add(x);
                extraTotal += ext.size();
                if (miss.isEmpty() && ext.isEmpty()) continue;
                System.out.printf("    %-20s 文档 %d 列 / 现库 %d 列", e.getKey(), e.getValue().size(), have.size());
                if (!miss.isEmpty()) { System.out.print("  ❌ 缺: " + String.join("、", miss)); missing += miss.size(); }
                if (!ext.isEmpty()) System.out.print("  ℹ 多出 " + ext.size() + " 列(未登记即不显示)");
                System.out.println();
            }
        }
        System.out.println("    结论: 文档认定列缺失 " + missing + " 个" + (missing == 0 ? " ✅" : " ❌")
                + ";本库多出 " + extraTotal + " 列(rebuild 血统,未登记即不显示,不判 FAIL)");
        return missing;
    }

    static List<Row> readTsv(Path f) throws Exception {
        List<Row> out = new ArrayList<>();
        List<String> lines = Files.readAllLines(f, StandardCharsets.UTF_8);
        for (int i = 1; i < lines.size(); i++) {
            if (lines.get(i).isBlank()) continue;
            String[] t = lines.get(i).split("\t", -1);
            Row r = new Row();
            r.ord = Integer.parseInt(t[0]); r.panel = t[1]; r.col = t[2]; r.label = t[3]; r.place = t[4];
            r.seq = Integer.parseInt(t[5]); r.type = t[6];
            r.width = t[7].isEmpty() ? -1 : Integer.parseInt(t[7]);
            r.flags = t[8]; r.alias = t[9]; r.refPanel = t[10]; r.refField = t[11];
            r.displayField = t[12]; r.refFilter = t[13]; r.dictSql = t[14]; r.labelEn = t[15]; r.colGroup = t[16];
            out.add(r);
        }
        return out;
    }

    static List<Row> readDb(String db) throws Exception {
        List<Row> out = new ArrayList<>();
        try (Connection c = conn(db);
             PreparedStatement ps = c.prepareStatement(
                     "SELECT panel_code,col_name,label,place,seq,width,editable,required,hidden,visible,"
                   + "alias,data_type,ref_panel,ref_field,display_field,ref_filter,dict_sql,label_en,col_group "
                   + "FROM yj_field WHERE panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Row r = new Row();
                r.panel = rs.getString(1); r.col = rs.getString(2); r.label = rs.getString(3);
                r.place = rs.getString(4); r.seq = rs.getInt(5); r.width = rs.getObject(6) == null ? -1 : rs.getInt(6);
                r.flags = (rs.getBoolean(7) ? "E" : "-") + (rs.getBoolean(8) ? "R" : "-")
                        + (rs.getBoolean(9) ? "H" : "-") + (rs.getBoolean(10) ? "V" : "-");
                r.alias = rs.getString(11); r.type = rs.getString(12); r.refPanel = rs.getString(13);
                r.refField = rs.getString(14); r.displayField = rs.getString(15); r.refFilter = rs.getString(16);
                r.dictSql = rs.getString(17); r.labelEn = rs.getString(18); r.colGroup = rs.getString(19);
                out.add(r);
            }
        }
        return out;
    }

    static Connection conn(String db) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true", USER, PASS);
    }

    static List<Row> filter(List<Row> rows, String panel) {
        List<Row> out = new ArrayList<>();
        for (Row r : rows) if (panel.equals(r.panel)) out.add(r);
        return out;
    }

    static String key(Row r) { return r.panel + "|" + r.label + "|" + r.col + "|" + r.place + "|" + r.seq; }

    static Row match(List<Row> rows, Row r) {
        for (Row x : rows) if (key(x).equals(key(r))) return x;
        return null;
    }

    static boolean sameContent(Row a, Row b) {
        return a.width == b.width && nz(a.flags).equals(nz(b.flags)) && nz(a.type).equals(nz(b.type))
                && nz(a.refPanel).equals(nz(b.refPanel)) && nz(a.refField).equals(nz(b.refField))
                && nz(a.displayField).equals(nz(b.displayField)) && nz(a.refFilter).equals(nz(b.refFilter))
                && nz(a.dictSql).equals(nz(b.dictSql)) && nz(a.labelEn).equals(nz(b.labelEn))
                && nz(a.colGroup).equals(nz(b.colGroup)) && nz(a.alias).equals(nz(b.alias));
    }

    static String nz(String s) { return s == null ? "" : s; }

    static Map<String, Integer> dupKeys(List<Row> rows) {
        Map<String, Integer> m = new HashMap<>();
        for (Row r : rows) m.merge(key(r), 1, Integer::sum);
        return m;
    }

    /** 按 (seq, 行内 id 序) 给名次;基线行的 id 序 = TSV 的 ord */
    static List<Row> rank(List<Row> rows) {
        List<Row> s = new ArrayList<>(rows);
        s.sort(Comparator.comparingInt((Row r) -> r.seq).thenComparingInt(r -> r.ord));
        for (int i = 0; i < s.size(); i++) s.get(i).rank = i + 1;
        return s;
    }

    static void printExamples(String what, List<Row> a, List<Row> b) {
        int n = 0;
        for (Row r : a) {
            if (match(b, r) == null && n++ < 6)
                System.out.printf("       · %s %s(%s) @%s seq=%s%n", what, r.label, r.col, r.place, r.seq);
        }
    }
}
