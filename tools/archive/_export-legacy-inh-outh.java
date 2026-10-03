import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * 迁移前导出:把**遗留** inh / outh 整表导出为 CSV(库存三表重构的回退抓手)。
 *
 * 为什么必须在跑链**之前**单独做:
 *   migrate-stock-flow-tables-2026-09-30.sql 会把老 inh/outh 复制到 inh_bak_20260930 /
 *   outh_bak_20260930 再清空重建;而链上稍后的 migrate-stock-flow-index-filter-2026-09-30.sql
 *   会**把那两张备份表 DROP 掉**(理由是体检第 10 项棘轮要求备份表数为 0)。
 *   该脚本头部写明「**顺序红线:先导出 CSV 并核对行数,确认无误后才跑本脚本**」——
 *   但这个前置是人肉步骤,DbSync 串行跑完整条链**不会**给你插入导出的机会。
 *   2026-10-03 实测教训:测试库 HSDZ_MES_TEST 演练时直接跑到底,备份表已被删,
 *   老纺织 inh/outh 数据随之丢失(库内已无任何 *_bak_* 表)。故正式库改为先导出。
 *
 * 用法(tools 目录):
 *   java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive\_export-legacy-inh-outh.java [输出目录]
 *   库由 YINJIA_SQL_DB 指定(默认 HSDZ_MES);口令取 YINJIA_SQL_PASS。
 */
public class _export_legacy_inh_outh {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static String esc(String s) {
        if (s == null) return "";
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0)
            return '"' + s.replace("\"", "\"\"") + '"';
        return s;
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(System.getProperty("user.dir")).resolve("archive");
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("[db] " + c.getCatalog());
            for (String t : new String[]{"inh", "outh"}) {
                List<String> cols = new ArrayList<>();
                try (ResultSet rs = c.getMetaData().getColumns(null, "dbo", t, null)) {
                    while (rs.next()) cols.add(rs.getString("COLUMN_NAME"));
                }
                if (cols.isEmpty()) { System.out.println(t + " -> 表不存在,跳过"); continue; }
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < cols.size(); i++) sb.append(i > 0 ? "," : "").append(esc(cols.get(i)));
                sb.append('\n');
                int n = 0;
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT * FROM [" + t + "]")) {
                    while (rs.next()) {
                        for (int i = 1; i <= cols.size(); i++) {
                            if (i > 1) sb.append(',');
                            sb.append(esc(rs.getString(i)));
                        }
                        sb.append('\n');
                        n++;
                    }
                }
                Path out = dir.resolve("_legacy-" + t + "-backup-" + DB + ".csv");
                Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
                System.out.println(t + " -> " + out.getFileName() + "  行=" + n + " 列=" + cols.size());
            }
        }
    }
}
