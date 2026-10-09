import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * _dump-dropped-docs.java — 待下架对象的「回退抓手」导出(只读,不动库)。
 *
 * <p>下架清单(用户 2026-10-08 口径):请购单 PU_REQ;其他入库单 OTHER_IN、其他出库单 OTHER_OUT、
 * 委外入库单 OUTSOURCE_IN、委外发料单 OUTSOURCE_ISSUE(每类含 单据 + 明细表 + 统计表),共 13 面板。
 *
 * <p>产出(默认写到 tools/archive/_panel-age/_backup-<今日>/):
 * <ul>
 *   <li>yj_panel.csv / yj_field.csv / yj_role_panel.csv / yj_translation.csv —— 元数据行(删了什么,逐行留底)</li>
 *   <li>restore-metadata.sql —— 上述四张表的一键回插脚本(含 IDENTITY_INSERT)</li>
 *   <li>views.sql —— 8 个待删视图的原始定义(CREATE VIEW 文本)</li>
 *   <li>tables-ddl.sql —— 10 张待删表的列定义 + 索引 + 中文注明(按目录拼出的重建骨架)</li>
 * </ul>
 *
 * <p>用法(tools 目录):
 * <pre>java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive/_panel-age/_dump-dropped-docs.java</pre>
 * 库由 YINJIA_SQL_DB 指定(默认 HSDZ_MES),口令 YINJIA_SQL_PASS(默认见下)。
 */
public class DropDump {

    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static String url() {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        return "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    }

    /** 13 个下架面板(单据 + 明细表 + 统计表)。 */
    static final List<String> PANELS = List.of(
            "PU_REQ",
            "OTHER_IN", "OTHER_IN_DETAIL", "OTHER_IN_STATS",
            "OTHER_OUT", "OTHER_OUT_DETAIL", "OTHER_OUT_STATS",
            "OUTSOURCE_IN", "OUTSOURCE_IN_DETAIL", "OUTSOURCE_IN_STATS",
            "OUTSOURCE_ISSUE", "OUTSOURCE_ISSUE_DETAIL", "OUTSOURCE_ISSUE_STATS");

    /** 10 张待删物理表 + 8 个待删视图。 */
    static final List<String> TABLES = List.of(
            "bd_pu_req", "bl_pu_req",
            "bd_other_in", "bl_other_in", "bd_other_out", "bl_other_out",
            "bd_outsource_in", "bl_outsource_in", "bd_outsource_issue", "bl_outsource_issue");
    static final List<String> VIEWS = List.of(
            "v_other_in_detail", "v_other_in_stats", "v_other_out_detail", "v_other_out_stats",
            "v_outsource_in_detail", "v_outsource_in_stats",
            "v_outsource_issue_detail", "v_outsource_issue_stats");

    static String esc(String s) {
        if (s == null) return "";
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0)
            return '"' + s.replace("\"", "\"\"") + '"';
        return s;
    }

    /** 值 → SQL 字面量(全按字符串给,数值/日期/bit 让 SQL Server 隐式转换;NULL 保持 NULL)。 */
    static String lit(String v) {
        if (v == null) return "NULL";
        return "N'" + v.replace("'", "''") + "'";
    }

    /** 按列元数据导出「表 + WHERE」为 CSV,返回行数。 */
    static int dumpCsv(Connection c, String table, String where, Path out) throws Exception {
        List<String> cols = new ArrayList<>();
        List<Integer> types = new ArrayList<>();
        try (ResultSet rs = c.getMetaData().getColumns(null, "dbo", table, null)) {
            while (rs.next()) { cols.add(rs.getString("COLUMN_NAME")); types.add(rs.getInt("DATA_TYPE")); }
        }
        if (cols.isEmpty()) { System.out.println("  [skip] " + table + " 不存在"); return -1; }
        int[] numeric = {Types.INTEGER, Types.BIGINT, Types.SMALLINT, Types.TINYINT, Types.DECIMAL,
                Types.NUMERIC, Types.FLOAT, Types.REAL, Types.BIT};
        Set<Integer> numSet = new HashSet<>();
        for (int t : numeric) numSet.add(t);
        StringBuilder csv = new StringBuilder();
        for (int i = 0; i < cols.size(); i++) csv.append(i > 0 ? "," : "").append(esc(cols.get(i)));
        csv.append("\r\n");
        int rows = 0;
        String sql = "SELECT * FROM dbo." + table + (where == null ? "" : " WHERE " + where);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                for (int i = 1; i <= cols.size(); i++) {
                    if (i > 1) csv.append(',');
                    csv.append(esc(rs.getString(i)));
                }
                csv.append("\r\n");
                rows++;
            }
        }
        Files.writeString(out, "\uFEFF" + csv, StandardCharsets.UTF_8);
        System.out.println("  " + table + " -> " + out.getFileName() + " (" + rows + " 行)");
        return rows;
    }

    /** 生成一键回插 SQL(元数据四表)。 */
    static void dumpRestore(Connection c, Path out) throws Exception {
        StringBuilder sql = new StringBuilder();
        sql.append("-- restore-metadata.sql — 回退「下架 13 面板」的元数据(由 _dump-dropped-docs.java 生成)\n")
           .append("-- 用法:两账套分别执行;脚本幂等(先删后插,只针对这 13 个面板编码与其面板名译名)\n")
           .append("SET NOCOUNT ON;\nGO\n")
           .append("IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库\nGO\n\n");
        String panelList = "'" + String.join("','", PANELS) + "'";

        for (String tbl : List.of("yj_panel", "yj_field", "yj_role_panel")) {
            List<String> cols = new ArrayList<>();
            List<Boolean> identity = new ArrayList<>();
            try (ResultSet rs = c.getMetaData().getColumns(null, "dbo", tbl, null)) {
                while (rs.next()) {
                    cols.add(rs.getString("COLUMN_NAME"));
                    identity.add("YES".equalsIgnoreCase(rs.getString("IS_AUTOINCREMENT")));
                }
            }
            String key = "panel_code";
            sql.append("-- ══ ").append(tbl).append(" ══\n")
               .append("DELETE FROM dbo.").append(tbl).append(" WHERE ").append(key).append(" IN (").append(panelList).append(");\nGO\n");
            boolean hasId = identity.contains(true);
            if (hasId) sql.append("SET IDENTITY_INSERT dbo.").append(tbl).append(" ON;\nGO\n");
            int n = 0;
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT * FROM dbo." + tbl + " WHERE " + key + " IN (" + panelList + ")")) {
                while (rs.next()) {
                    StringBuilder vals = new StringBuilder();
                    for (int i = 0; i < cols.size(); i++) {
                        if (i > 0) vals.append(", ");
                        vals.append(lit(rs.getString(i + 1)));
                    }
                    sql.append("INSERT INTO dbo.").append(tbl).append(" (")
                       .append(String.join(", ", cols)).append(") VALUES (").append(vals).append(");\n");
                    n++;
                }
            }
            if (hasId) sql.append("GO\nSET IDENTITY_INSERT dbo.").append(tbl).append(" OFF;\n");
            sql.append("GO\n\n");
            System.out.println("  restore-metadata.sql: " + tbl + " " + n + " 行");
        }
        // 面板名译名(panel scope;仅这 13 个中文名)
        sql.append("-- ══ yj_translation(panel 名,scope='panel')══\n")
           .append("DELETE FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key IN (\n")
           .append("  SELECT DISTINCT panel_name FROM dbo.yj_panel WHERE panel_code IN (").append(panelList).append("));\n")
           .append("-- 注:上面这句删的是「当前库里这 13 个面板的中文名」的全部译名;若同名面板还有别的,\n")
           .append("--     迁移脚本用的是「无其它面板同名」守卫 —— 回退时如需精确,请按 CSV 里的 ref_key 逐条回插。\nGO\n\n");
        Files.writeString(out, sql.toString(), StandardCharsets.UTF_8);
        System.out.println("  restore-metadata.sql -> " + out.getFileName());
    }

    static void dumpViews(Connection c, Path out) throws Exception {
        StringBuilder sql = new StringBuilder("-- views.sql — 8 个待删视图的原始定义(回退用:去掉 IF 守卫直接建)\nUSE " +
                c.getCatalog() + ";\nGO\n\n");
        for (String v : VIEWS) {
            try (PreparedStatement ps = c.prepareStatement("SELECT m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID(?)")) {
                ps.setString(1, "dbo." + v);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next() && rs.getString(1) != null) {
                        sql.append("-- ---- ").append(v).append(" ----\n").append(rs.getString(1)).append("\nGO\n\n");
                    } else {
                        sql.append("-- ---- ").append(v).append(" (不存在/无定义) ----\nGO\n\n");
                    }
                }
            }
        }
        Files.writeString(out, sql.toString(), StandardCharsets.UTF_8);
        System.out.println("  views.sql -> " + out.getFileName());
    }

    static void dumpTableDdl(Connection c, Path out) throws Exception {
        StringBuilder sql = new StringBuilder("-- tables-ddl.sql — 10 张待删表的列定义 + 索引 + 中文注明(重建骨架)\nUSE " +
                c.getCatalog() + ";\nGO\n\n");
        for (String t : TABLES) {
            if (c.getMetaData().getColumns(null, "dbo", t, null).next() == false) {
                sql.append("-- ").append(t).append(" (不存在)\n\n");
                continue;
            }
            sql.append("-- ---- ").append(t).append(" ----\nCREATE TABLE dbo.[").append(t).append("] (\n");
            List<String> defs = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT c.name, ty.name AS tname, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity,"
                                 + " OBJECT_DEFINITION(c.default_object_id) AS def"
                                 + " FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id"
                                 + " WHERE c.object_id = OBJECT_ID('dbo." + t + "') ORDER BY c.column_id")) {
                while (rs.next()) {
                    String ty = rs.getString("tname");
                    int ml = rs.getInt("max_length");
                    String type;
                    switch (ty) {
                        case "nvarchar" -> type = "nvarchar(" + (ml < 0 ? "max" : ml / 2) + ")";
                        case "varchar" -> type = "varchar(" + (ml < 0 ? "max" : ml) + ")";
                        case "decimal", "numeric" -> type = ty + "(" + rs.getInt("precision") + "," + rs.getInt("scale") + ")";
                        default -> type = ty;
                    }
                    StringBuilder d = new StringBuilder("  [" + rs.getString("name") + "] " + type);
                    if (rs.getBoolean("is_identity")) d.append(" IDENTITY(1,1)");
                    if (rs.getString("def") != null) d.append(" DEFAULT ").append(rs.getString("def"));
                    if (!rs.getBoolean("is_nullable")) d.append(" NOT NULL");
                    defs.add(d.toString());
                }
            }
            sql.append(String.join(",\n", defs)).append("\n);\nGO\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT i.name, i.type_desc, i.is_unique,"
                         + " STUFF((SELECT ', ' + c2.name FROM sys.index_columns ic JOIN sys.columns c2"
                         + "   ON c2.object_id = ic.object_id AND c2.column_id = ic.column_id"
                         + "   WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0"
                         + "   ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 2, '') AS cols"
                         + " FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo." + t + "') AND i.name IS NOT NULL")) {
                while (rs.next()) {
                    sql.append("CREATE ").append(rs.getBoolean("is_unique") ? "UNIQUE " : "")
                       .append(rs.getString("type_desc").contains("CLUSTERED") && !rs.getString("type_desc").contains("NON")
                               ? "CLUSTERED" : "NONCLUSTERED")
                       .append(" INDEX [").append(rs.getString("name")).append("] ON dbo.[").append(t).append("] (")
                       .append(rs.getString("cols")).append(");\n");
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT ep.name, CAST(ep.value AS nvarchar(400)), COL_NAME(ep.major_id, ep.minor_id)"
                         + " FROM sys.extended_properties ep WHERE ep.major_id = OBJECT_ID('dbo." + t + "') AND ep.minor_id = 0")) {
                while (rs.next()) {
                    sql.append("EXEC sp_addextendedproperty N'").append(rs.getString(1)).append("', N'")
                       .append(rs.getString(2).replace("'", "''")).append("', N'SCHEMA', N'dbo', N'TABLE', N'")
                       .append(t).append("';\n");
                }
            }
            sql.append("GO\n\n");
        }
        Files.writeString(out, sql.toString(), StandardCharsets.UTF_8);
        System.out.println("  tables-ddl.sql -> " + out.getFileName());
    }

    public static void main(String[] args) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        Path dir = Paths.get("archive/_panel-age/_backup-20261008");
        if (args.length > 0) dir = Paths.get(args[0]);
        Files.createDirectories(dir);
        System.out.println("[db] " + db + "  [out] " + dir.toAbsolutePath());
        try (Connection c = DriverManager.getConnection(url(), USER, PASS)) {
            String panelList = "'" + String.join("','", PANELS) + "'";
            dumpCsv(c, "yj_panel", "panel_code IN (" + panelList + ")", dir.resolve("yj_panel.csv"));
            dumpCsv(c, "yj_field", "panel_code IN (" + panelList + ")", dir.resolve("yj_field.csv"));
            dumpCsv(c, "yj_role_panel", "panel_code IN (" + panelList + ")", dir.resolve("yj_role_panel.csv"));
            dumpCsv(c, "yj_translation",
                    "scope='panel' AND ref_key IN (SELECT panel_name FROM dbo.yj_panel WHERE panel_code IN (" + panelList + "))",
                    dir.resolve("yj_translation-panel.csv"));
            dumpRestore(c, dir.resolve("restore-metadata.sql"));
            dumpViews(c, dir.resolve("views.sql"));
            dumpTableDdl(c, dir.resolve("tables-ddl.sql"));
        }
        System.out.println("[done]");
    }
}
