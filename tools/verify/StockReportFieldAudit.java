import java.sql.*;
import java.util.*;

/**
 * StockReportFieldAudit.java — 库存报表组「字段重复 / 幽灵列」体检(回归闸)
 *
 * 为什么有它:2026-10-15 用户报「库存状况表出现字段重复」—— 库存状况表列表把 仓库编码/仓库/存货编码/存货 各显示了两遍。
 *   根因是 tools/migrate-server-converge-20261007.sql 的补缺守卫按 (panel_code,col_name,place) 三元组判存在,
 *   而报表类面板的原始字段 place 是合并值 'query,detail',收敛快照带的却是 'detail' ⇒ 被判「不存在」而重复插入
 *   (同批还复活了早被 migrate-report-dialog-fields.sql 删掉的 开始日期/结束日期)。
 *   清洗脚本 = tools/migrate-stock-report-dup-fields-20261015.sql。**只要迁移链再被整链重放一次,这批行就可能回来**
 *   (2026-10-05 就是这么把四单盖回上一代的),所以这里把「重复」变成一条可复跑的判据。
 *
 * 判定口径(flat 面板每一个 yj_field 行都会变成列表的一列 —— 见 PanelConfigService.buildDocConfig:
 *   flat ⇒ gridFields = def.fields();buildGridColumns 只按 visible 过滤,不做同名去重):
 *   ① 同名 label 多行  ⇒ 界面出现两列同名(QueryService.rowToLabels 按 label 收敛成一个键,两列内容还完全一样)
 *   ② 字段的 col_name 在面板 line_table(表或视图)里不存在 ⇒ 该列恒空 / 极端情况 SQL 报「列名无效」
 *   ③ 面板一个字段都没有 ⇒ 列表无列可渲染
 *   ①②③ 任一 > 0 即 FAIL(exit 1)。
 *
 * 只提示不判 FAIL 的两项(有意设计,别当故障改):
 *   · 同名列挂不同标签(如休眠面板 STOCK_STATUS 的 存货编码/存货 都取 kucun.wzdm —— setup-stock-status.sql 第 11/12 行
 *     是 light-mes fillCurrentStock 契约要求的形态):界面上两列**名字不同、值相同**,不是重复列。
 *   · 隐藏列(visible=0):不会渲染成列,只统计个数。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar verify\StockReportFieldAudit.java                  # 查 HSDZ_MES
 *   java -cp lib\mssql-jdbc.jar verify\StockReportFieldAudit.java HSDZ_MES_TEST    # 查测试账套
 *   java -cp lib\mssql-jdbc.jar verify\StockReportFieldAudit.java HSDZ_MES --all   # 扫描**全部** flat 面板
 *   (想看中文不错行:先 set JAVA_TOOL_OPTIONS=-Dstdout.encoding=UTF-8)
 *
 * ⚠ --all 目前会报出若干**历史遗留**(2026-10-15 实测):生产排产 MANU_SCHEDULE 29 组、排单计划 WO_SCHEDULE 13 组、
 *   材料出库单明细表/统计表 各 1 组、生产工单明细表 1 组 —— 它们是别的迁移留下的同类问题,尚未处置,不在本次范围内;
 *   默认口径因此只卡库存报表组(STOCK_BALANCE/STOCK_LEDGER/STOCK_SUMMARY/STOCK_DETAIL + 休眠的 STOCK_STATUS)。
 */
public class StockReportFieldAudit {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    /** 库存报表组(菜单「智能供应链 › 库存报表」四张)+ 已下线但接口仍在用的库存状况面板 */
    static final String[] STOCK_PANELS = {"STOCK_BALANCE", "STOCK_LEDGER", "STOCK_SUMMARY", "STOCK_DETAIL", "STOCK_STATUS"};

    record Field(int id, String col, String label, String place, int seq, boolean visible) {}
    record Panel(String code, String name, String mode, String lineTable, List<Field> fields) {}

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 && !args[0].startsWith("--") ? args[0] : "HSDZ_MES";
        boolean all = Arrays.asList(args).contains("--all");
        List<Panel> panels = read(db, all);
        if (panels.isEmpty()) { System.err.println("[FATAL] 没有读到任何 flat 面板(" + db + ")"); System.exit(2); }

        System.out.println("[库] " + db + "  范围 = " + (all ? "全部 flat 面板" : "库存报表组"));
        Set<String> tables = new LinkedHashSet<>();
        for (Panel p : panels) tables.add(p.lineTable());

        int bad = 0;
        System.out.printf("  %-15s %-14s %5s  %5s %5s %5s %5s%n",
                "面板", "名称", "字段", "同名标签", "同名列ℹ", "缺物理列", "隐藏ℹ");
        for (Panel p : panels) {
            Map<String, Integer> byLabel = new HashMap<>(), byCol = new HashMap<>();
            for (Field f : p.fields()) {
                byLabel.merge(f.label(), 1, Integer::sum);
                byCol.merge(f.col(), 1, Integer::sum);
            }
            int dupLabel = 0, dupCol = 0, ghost = 0, hidden = 0;
            List<String> ex = new ArrayList<>();
            for (Map.Entry<String, Integer> e : byLabel.entrySet())
                if (e.getValue() > 1) { dupLabel++; ex.add(e.getKey() + "x" + e.getValue()); }
            for (Map.Entry<String, Integer> e : byCol.entrySet()) if (e.getValue() > 1) dupCol++;
            for (Field f : p.fields()) {
                if (!f.visible()) hidden++;
                if (!columnExists(db, p.lineTable(), f.col())) { ghost++; ex.add("缺列:" + f.col()); }
            }
            boolean empty = p.fields().isEmpty();
            int drift = dupLabel + ghost + (empty ? 1 : 0);
            bad += drift;
            System.out.printf("  %-15s %-14s %5d  %5d %5d %5d %5d  %s%n",
                    p.code(), p.name(), p.fields().size(), dupLabel, dupCol, ghost, hidden,
                    drift == 0 ? "✅" : "❌ " + String.join("、", ex.subList(0, Math.min(6, ex.size()))));
        }

        if (bad == 0) {
            System.out.println("[PASS] 库存报表字段无重复/无幽灵列(用户可见的列表列 = 面板字段,一对一)");
        } else {
            System.out.println("[FAIL] 共 " + bad + " 处 —— 重复列会被 buildGridColumns 原样下发到界面。"
                    + "处置:重跑 tools\\migrate-stock-report-dup-fields-20261015.sql"
                    + "(YINJIA_SQL_DB=<库> java -cp lib\\mssql-jdbc.jar DbSync.java run migrate-stock-report-dup-fields-20261015.sql),"
                    + "若重跑后仍报,说明有新的迁移又插了重复行,按本文件头①~④定位是哪一条。");
            System.exit(1);
        }
    }

    /** 面板字段(flat 面板全量字段都是列表列)+ 底层表/视图的可见列 */
    static List<Panel> read(String db, boolean all) throws Exception {
        List<Panel> out = new ArrayList<>();
        try (Connection c = conn(db)) {
            String sql = "SELECT panel_code, panel_name, line_table FROM yj_panel WHERE mode='flat'"
                    + (all ? "" : " AND panel_code IN (" + quoted(STOCK_PANELS) + ")")
                    + " ORDER BY panel_code";
            List<String[]> ps = new ArrayList<>();
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) ps.add(new String[]{rs.getString(1), rs.getString(2), rs.getString(3)});
            }
            for (String[] p : ps) {
                List<Field> fs = new ArrayList<>();
                try (PreparedStatement st = c.prepareStatement(
                        "SELECT id,col_name,label,place,seq,visible FROM yj_field WHERE panel_code=? ORDER BY seq,id")) {
                    st.setString(1, p[0]);
                    try (ResultSet rs = st.executeQuery()) {
                        while (rs.next()) fs.add(new Field(rs.getInt(1), rs.getString(2), rs.getString(3),
                                rs.getString(4), rs.getInt(5), rs.getBoolean(6)));
                    }
                }
                out.add(new Panel(p[0], p[1], "flat", p[2], fs));
            }
        }
        return out;
    }

    static boolean columnExists(String db, String table, String col) throws SQLException {
        try (Connection c = conn(db); PreparedStatement ps = c.prepareStatement(
                "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.' + ?) AND name = ?")) {
            ps.setString(1, table);
            ps.setString(2, col);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() && rs.getInt(1) > 0; }
        }
    }

    static String quoted(String[] arr) {
        StringBuilder sb = new StringBuilder();
        for (String s : arr) { if (sb.length() > 0) sb.append(','); sb.append('\'').append(s).append('\''); }
        return sb.toString();
    }

    static Connection conn(String db) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true", USER, PASS);
    }
}
