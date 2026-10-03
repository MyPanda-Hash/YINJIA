import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * 任务 1b 专用探针:① 把 inh_bak_20260930 / outh_bak_20260930 整表导出为 CSV(回退抓手);
 * ② 盘点 RKD/CKD 在库里所有残留引用;③ 核对索引/备份表状态。
 *
 * 为什么用 JDBC 而不是 sqlcmd:列名与数据含中文且列很多(115/126 列),
 * sqlcmd 的 -W 与 -y/-h 互斥,取不全文本。
 *
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive/_stock-flow-backup-export.java
 * 库由环境变量 YINJIA_SQL_DB 指定(默认 HSDZ_MES);口令取 YINJIA_SQL_PASS。
 */
public class StockBakExport {

    static String url() {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        return "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    }

    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    /** RFC4180 转义:含逗号/引号/换行的字段加引号,内部引号翻倍。 */
    static String esc(String s) {
        if (s == null) return "";
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0)
            return '"' + s.replace("\"", "\"\"") + '"';
        return s;
    }

    static int[] dump(Connection c, String table, String section, String csvPath) throws Exception {
        List<String> cols = new ArrayList<>();
        try (ResultSet rs = c.getMetaData().getColumns(null, "dbo", table, null)) {
            while (rs.next()) cols.add(rs.getString("COLUMN_NAME"));
        }
        if (cols.isEmpty()) { System.out.println(table + " -> (表不存在)"); return new int[]{-1, -1}; }
        StringBuilder csv = new StringBuilder();
        for (int i = 0; i < cols.size(); i++) csv.append(i > 0 ? "," : "").append(esc(cols.get(i)));
        csv.append("\r\n");
        int rows = 0;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT * FROM dbo." + table)) {
            int n = cols.size();
            while (rs.next()) {
                for (int i = 1; i <= n; i++) {
                    if (i > 1) csv.append(',');
                    csv.append(esc(rs.getString(i)));
                }
                csv.append("\r\n");
                rows++;
            }
        }
        Path p = Paths.get(csvPath);
        if (section != null) {  // 两表合并进同一份 CSV:段头 + 段尾行数
            if (!Files.exists(p)) {
                // 主文件开头写 UTF-8 BOM:这是给人用的回退抓手,Excel/记事本在中文 Windows 上
                // 无 BOM 会按 ANSI(GBK)解 UTF-8 中文 ⇒ 乱码。BOM 只影响显示,不影响程序读取。
                Files.writeString(p, "\uFEFF", StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            }
            Files.writeString(p, "\r\n# ===== " + section + " (" + rows + " rows) =====\r\n",
                    StandardCharsets.UTF_8, StandardOpenOption.APPEND);
            Files.writeString(p, csv.toString(), StandardCharsets.UTF_8, StandardOpenOption.APPEND);
        } else {
            Files.write(p, ("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8));
        }
        System.out.println(table + " -> " + rows + " 行 / " + cols.size() + " 列");
        return new int[]{rows, cols.size()};
    }

    static void q(Connection c, String title, String sql) {
        System.out.println("---- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next() && n++ < 40) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
                    row.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println("  " + row);
            }
            if (n == 0) System.out.println("  (no rows)");
        } catch (Exception e) { System.out.println("  ERR: " + e.getMessage()); }
    }

    public static void main(String[] args) throws Exception {
        String csv = args.length > 0 ? args[0] : null;
        try (Connection c = DriverManager.getConnection(url(), USER, PASS)) {
            System.out.println("connected: " + c.getCatalog() + " as " + c.getMetaData().getUserName());
            if (csv != null) Files.deleteIfExists(Paths.get(csv));
            if (csv != null) {
                dump(c, "inh_bak_20260930", "inh_bak_20260930 (原遗留纺织表 inh,重建前)", csv);
                dump(c, "outh_bak_20260930", "outh_bak_20260930 (原遗留纺织表 outh,重建前)", csv);
            }
            q(c, "备份表行数", "SELECT 'inh' AS t, COUNT(*) AS n FROM inh_bak_20260930"
                    + " UNION ALL SELECT 'outh', COUNT(*) FROM outh_bak_20260930");
            q(c, "UX_inh/UX_outh 索引 has_filter", "SELECT i.name, i.has_filter, i.is_unique, i.filter_definition"
                    + " FROM sys.indexes i WHERE i.name IN ('UX_inh_src_rid','UX_outh_src_rid')");
            q(c, "inh/outh 行数", "SELECT 'inh' AS t, COUNT(*) AS n FROM inh UNION ALL SELECT 'outh', COUNT(*) FROM outh");
            q(c, "RKD/CKD 在 yj_panel/yj_field/yj_role_panel", "SELECT 'yj_panel' AS t, COUNT(*) AS n FROM yj_panel WHERE panel_code IN ('RKD','CKD')"
                    + " UNION ALL SELECT 'yj_field', COUNT(*) FROM yj_field WHERE panel_code IN ('RKD','CKD')"
                    + " UNION ALL SELECT 'yj_role_panel', COUNT(*) FROM yj_role_panel WHERE panel_code IN ('RKD','CKD')");
            q(c, "RKD/CKD 其它元数据表残留", "SELECT 'yj_doc_status' AS t, COUNT(*) AS n FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')"
                    + " UNION ALL SELECT 'yj_translation(panel)', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key IN (N'入库单',N'出库单')"
                    + " UNION ALL SELECT 'yj_schema_log', 0");
            q(c, "RKD/CKD 面板", "SELECT panel_code, panel_name, line_table, head_table, data_table FROM yj_panel WHERE panel_code IN ('RKD','CKD')");
            q(c, "RKD/CKD 字段列名(应全在 bak 表里)", "SELECT panel_code, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('RKD','CKD') GROUP BY panel_code");
        }
    }
}
