import java.sql.*;
import java.util.*;

/**
 * _FieldGap.java — 「生产过程」单据的字段覆盖与控件配置体检(只读)2026-10-18
 *
 * 求证用户口径「有一些功能也不完善」:
 *   ① 底表物理列里有多少**没挂到面板字段**上(没上表单 ⇒ 用户看不到/录不了);
 *   ② 每张面板的字段是「裸输入框」还是有参照/字典(dict_sql / ref_panel 为空 = 只能手打,
 *      关联不到工单/物料/批次 ⇒ 功能不完善的典型);
 *   ③ 必填 vs 可编辑(hidden / editable=0 的字段是否合理)。
 *
 * 用法(tools 目录):
 *   java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_prod-process-audit/_FieldGap.java [库名]
 */
public class _FieldGap {

    static final String[][] PANELS = {
        {"WO_REPORT", "工序报工单"}, {"WO_REPORT_LIST", "报工记录"}, {"WO_COMPLETION_LIST", "完工明细"},
        {"PROD_ABN", "生产异常处理单"}, {"DAY_REPORT", "生产日报表"}, {"FEED_CONFIRM", "投料确认单"},
        {"MIX_RECORD", "物料混合记录"}, {"GRAN_RECORD", "造粒记录"}, {"WH_RECORD", "无黑处理登记"},
        {"PACK_CONFIRM", "封箱确认"},
    };

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            for (String[] p : PANELS) {
                String code = p[0], name = p[1];
                String head = q1(c, "SELECT head_table FROM yj_panel WHERE panel_code=?", code);
                String line = q1(c, "SELECT line_table FROM yj_panel WHERE panel_code=?", code);
                System.out.println("\n════ " + code + " " + name + " (head=" + head + " line=" + line + ") ════");

                // 面板字段 + 控件配置
                List<Map<String, Object>> fields = rows(c,
                    "SELECT col_name,label,place,seq,editable,required,hidden,dict_sql,ref_panel,ref_field FROM yj_field WHERE panel_code=? ORDER BY seq,id", code);
                int bare = 0, withDict = 0, withRef = 0;
                StringBuilder bareList = new StringBuilder();
                for (Map<String, Object> f : fields) {
                    boolean hasDict = f.get("dict_sql") != null && !String.valueOf(f.get("dict_sql")).isBlank();
                    boolean hasRef = f.get("ref_panel") != null && !String.valueOf(f.get("ref_panel")).isBlank();
                    if (hasRef) withRef++;
                    else if (hasDict) withDict++;
                    else {
                        bare++;
                        String isNum = String.valueOf(f.get("col_name")).matches(".*(数量|重量|时间|日期|温度|湿度|含量|人数|批次|单号|编码|编号).*") ? "△" : "  ";
                        if (bareList.length() < 400) bareList.append(isNum).append(str(f.get("label"))).append("  ");
                    }
                }
                System.out.println("  字段 " + fields.size() + " 个: 参照=" + withRef + " 字典=" + withDict + " 裸输入=" + bare);
                System.out.println("  裸输入字段: " + bareList);

                // 物理列覆盖
                for (String t : new String[]{head, line}) {
                    if (t == null || t.isBlank()) continue;
                    Set<String> physical = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
                    try (ResultSet rs = c.getMetaData().getColumns(c.getCatalog(), "dbo", t, null)) {
                        while (rs.next()) {
                            String cn = rs.getString("COLUMN_NAME");
                            if (cn.toLowerCase().startsWith("asp_")) continue;
                            physical.add(cn);
                        }
                    }
                    Set<String> mapped = new HashSet<>();  // col_name 对物理列的映射(面板 col_name 可能与物理列不同名)
                    Set<String> labels = new HashSet<>();
                    for (Map<String, Object> f : fields) {
                        mapped.add(String.valueOf(f.get("col_name")).toLowerCase());
                        labels.add(str(f.get("label")));
                    }
                    List<String> missing = new ArrayList<>();
                    for (String cn : physical) if (!mapped.contains(cn.toLowerCase())) missing.add(cn);
                    System.out.println("  物理列 " + t + ": " + physical.size() + " 个, 未挂面板 " + missing.size() + " 个");
                    if (!missing.isEmpty()) System.out.println("    未挂: " + String.join(", ", missing.size() > 24 ? missing.subList(0, 24) : missing) + (missing.size() > 24 ? " …" : ""));
                }
            }
        }
    }

    static String q1(Connection c, String sql, Object... args) {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getString(1) : null; }
        } catch (SQLException e) { return null; }
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

    static String str(Object v) { return v == null ? "" : String.valueOf(v).trim(); }
}
