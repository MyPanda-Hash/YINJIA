import java.sql.*;
import java.util.*;

/**
 * _RefDesign.java — 参照配置取证与候选目标清单(只读)2026-10-18
 *  ① 现网已配好参照的 yj_field 样例(照抄模式,含 ref_filter/display_field/alias 用法);
 *  ② 「生产过程」10 张面板里仍是裸输入的字段清单(要改的对象);
 *  ③ 可参照的目标面板(工单/产品/物料/工序/产线/批次)及其字段名,供 ref_field 取值。
 *
 * 用法(tools 目录):java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_prod-process-audit/_RefDesign.java [库名]
 */
public class _RefDesign {

    static final String[] PANELS = {
        "WO_REPORT", "WO_REPORT_LIST", "WO_COMPLETION_LIST", "PROD_ABN", "DAY_REPORT",
        "FEED_CONFIRM", "MIX_RECORD", "GRAN_RECORD", "WH_RECORD", "PACK_CONFIRM",
    };
    /** 关键词 → 可能的目标面板(按 label 或 panel_name 匹配) */
    static final String[] TARGET_WORDS = {"产品", "物料", "工序", "产线", "生产线", "批次", "工单", "仓库", "客户"};

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");

            System.out.println("\n── ① 现网参照样例(近 12 个非空配置) ──");
            for (Map<String, Object> r : rows(c,
                    "SELECT TOP 12 panel_code,col_name,label,ref_panel,ref_field,display_field,alias,ref_filter,dict_sql "
                  + "FROM yj_field WHERE ref_panel IS NOT NULL AND ref_panel<>'' ORDER BY panel_code,seq")) {
                System.out.printf("  %-16s %-14s %-10s -> %s.%s display=%s alias=%s filter=%s%n",
                    s(r.get("panel_code")), s(r.get("col_name")), s(r.get("label")),
                    s(r.get("ref_panel")), s(r.get("ref_field")),
                    s(r.get("display_field")), s(r.get("alias")), s(r.get("ref_filter")));
            }

            System.out.println("\n── ② 生产过程 10 张面板的裸输入字段 ──");
            for (String code : PANELS) {
                List<String> bare = new ArrayList<>();
                for (Map<String, Object> r : rows(c,
                        "SELECT label,col_name FROM yj_field WHERE panel_code=? "
                      + "AND (ref_panel IS NULL OR ref_panel='') AND (dict_sql IS NULL OR dict_sql='') ORDER BY seq,id", code)) {
                    bare.add(s(r.get("label")) + "(" + s(r.get("col_name")) + ")");
                }
                System.out.println("  " + code + " [" + bare.size() + "]: " + String.join(" ", bare));
            }

            System.out.println("\n── ③ 候选目标面板(名字含关键词) ──");
            for (String w : TARGET_WORDS) {
                for (Map<String, Object> r : rows(c,
                        "SELECT panel_code,panel_name,mode,line_table FROM yj_panel WHERE panel_name LIKE ? ORDER BY panel_code",
                        "%" + w + "%")) {
                    String pc = s(r.get("panel_code"));
                    System.out.printf("  [%s] %-22s %-16s mode=%-8s line=%s%n", w, pc, s(r.get("panel_name")), s(r.get("mode")), s(r.get("line_table")));
                    List<String> labels = new ArrayList<>();
                    for (Map<String, Object> f : rows(c, "SELECT TOP 12 label FROM yj_field WHERE panel_code=? ORDER BY seq,id", pc)) labels.add(s(f.get("label")));
                    System.out.println("      字段: " + String.join(" | ", labels));
                }
            }
        }
    }

    static List<Map<String, Object>> rows(Connection c, String sql, Object... args) throws SQLException {
        List<Map<String, Object>> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnLabel(i).toLowerCase(), rs.getObject(i));
                    out.add(m);
                }
            }
        }
        return out;
    }

    static String s(Object v) { return v == null ? "" : String.valueOf(v).trim(); }
}
