import java.sql.*;
import java.util.*;

/** _RefTarget.java — 精确列目标面板字段(ref_panel/ref_field 取值用,只读)2026-10-18
 * 用法(tools):java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive/_prod-process-audit/_RefTarget.java [库名] [面板码...]
 * 不带面板码时打印内置候选:INV / OP / PROD_LINE / WORK_ORDER_LIST / 批号类 / EMP / TEAM。
 */
public class _RefTarget {
    static final String[] DEF = {"INV", "OP", "PROD_LINE", "WORK_ORDER_LIST", "EMP", "TEAM", "DEPT", "CK", "WH"};

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        List<String> codes = new ArrayList<>();
        for (int i = 1; i < a.length; i++) codes.add(a[i]);
        if (codes.isEmpty()) codes.addAll(Arrays.asList(DEF));
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            for (String code : codes) {
                List<Map<String, Object>> p = rows(c, "SELECT panel_code,panel_name,mode,line_table,head_table FROM yj_panel WHERE panel_code=?", code);
                if (p.isEmpty()) { System.out.println("\n[" + code + "] 面板不存在"); continue; }
                Map<String, Object> row = p.get(0);
                System.out.println("\n[" + code + "] " + s(row.get("Panel_Name")) + s(row.get("panel_name"))
                    + "  mode=" + s(row.get("mode")) + " line=" + s(row.get("line_table")) + " head=" + s(row.get("head_table")));
                StringBuilder sb = new StringBuilder();
                for (Map<String, Object> f : rows(c, "SELECT label,col_name,place,visible,hidden FROM yj_field WHERE panel_code=? ORDER BY seq,id", code)) {
                    boolean hiddenF = "1".equals(s(f.get("hidden")));
                    sb.append(s(f.get("label"))).append("(").append(s(f.get("col_name"))).append(")")
                      .append(hiddenF ? "[隐]" : "").append("  ");
                }
                System.out.println("  " + sb);
            }
            System.out.println("\n── 名字含「批次/批号」的面板 ──");
            for (Map<String, Object> r : rows(c, "SELECT panel_code,panel_name,mode FROM yj_panel WHERE panel_name LIKE ? OR panel_name LIKE ?", "%批次%", "%批号%")) {
                System.out.println("  " + s(r.get("panel_code")) + " " + s(r.get("panel_name")) + " mode=" + s(r.get("mode")));
            }
            System.out.println("\n── 名字含「生产工单/工单」的面板 ──");
            for (Map<String, Object> r : rows(c, "SELECT panel_code,panel_name,mode,line_table FROM yj_panel WHERE panel_name LIKE ?", "%工单%")) {
                System.out.println("  " + s(r.get("panel_code")) + " " + s(r.get("panel_name")) + " mode=" + s(r.get("mode")) + " line=" + s(r.get("line_table")));
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
