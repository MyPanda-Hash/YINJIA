import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;

/**
 * 一次性留档导出器（只读源库）。
 *
 * 来源：SQL Server 实例 localhost 上的快照库 HSDZ_MES_0909（2026-09-10 从
 *       HSDZ_MES_damaged_20260910.bak 恢复，294 张表），该库保留着正式库
 *       HSDZ_MES/HSDZ_MES_TEST 于 2026-09-29 清理掉的 244 张未用表里的这 6 张。
 *
 * 本程序只执行 SELECT（sys.* 目录视图 + 6 张表的全量数据），不做任何写库操作。
 * 输出：<outDir>/<表名>.csv（UTF-8 带 BOM、CRLF、RFC4180 引号规则、原始列名表头）
 *       <outDir>/schema.sql（CREATE TABLE，列名/类型/长度/可空性/IDENTITY 均实测）
 *
 * 编译运行（JDK 25，tools/lib/mssql-jdbc.jar 为驱动）：
 *   javac -encoding UTF-8 -cp tools\lib\mssql-jdbc.jar -d <临时目录> _export-legacy-tables.java
 *   java -cp "<临时目录>;tools\lib\mssql-jdbc.jar" ExportLegacyTables localhost HSDZ_MES_0909 <user> <pass> tools\archive\_legacy-tables-from-0909
 */
class ExportLegacyTables {

    static final String[] TABLES = {"gscs", "dm_langue", "permission", "s_commdata", "s_sys", "s_xtcs"};

    /** 期望行数（清库前审计快照口径），用于导出后自检 */
    static final Map<String, Integer> EXPECTED_ROWS = new LinkedHashMap<>();
    /** 期望列数（sys.columns 实测），用于导出后自检 */
    static final Map<String, Integer> EXPECTED_COLS = new LinkedHashMap<>();
    /** 排序键（各表 IDENTITY 主键列），保证 CSV 顺序稳定可复现 */
    static final Map<String, String> ORDER_BY = new LinkedHashMap<>();
    /** 表头说明（写入 schema.sql） */
    static final Map<String, String> TABLE_HEAD = new LinkedHashMap<>();
    /** 仅见于 deploy/sync-db-comments.sql、快照库无 MS_Description 的补充注释 */
    static final Map<String, String> FILE_ONLY_COMMENTS = new LinkedHashMap<>();

    static {
        EXPECTED_ROWS.put("gscs", 1);
        EXPECTED_ROWS.put("dm_langue", 15);
        EXPECTED_ROWS.put("permission", 1529);
        EXPECTED_ROWS.put("s_commdata", 712);
        EXPECTED_ROWS.put("s_sys", 5660);
        EXPECTED_ROWS.put("s_xtcs", 14);

        EXPECTED_COLS.put("gscs", 55);
        EXPECTED_COLS.put("dm_langue", 22);
        EXPECTED_COLS.put("permission", 18);
        EXPECTED_COLS.put("s_commdata", 28);
        EXPECTED_COLS.put("s_sys", 46);
        EXPECTED_COLS.put("s_xtcs", 17);

        ORDER_BY.put("gscs", "id");
        ORDER_BY.put("dm_langue", "id");
        ORDER_BY.put("permission", "ID");
        ORDER_BY.put("s_commdata", "ID");
        ORDER_BY.put("s_sys", "ID");
        ORDER_BY.put("s_xtcs", "id");

        TABLE_HEAD.put("gscs",
                "老「公司参数」单行表：公司名(gscs.gsmc)/电话/授权用户数(comqty/mobqty)/皮肤(pfwj)…… 带门诊药房味");
        TABLE_HEAD.put("dm_langue",
                "⚠ 表注释「语言（作废）」是错的：实测 frm 为微信ID/手机号、lb_wi 为在线标志、asp_time1 为登录时间，"
                        + "真身是「微信/移动端在线用户表」");
        TABLE_HEAD.put("permission",
                "老系统 用户×画面 读写权限明细（USERID/MODULE1/RW，GROP=分组），现由 yj_user/yj_role/yj_role_panel 取代");
        TABLE_HEAD.put("s_commdata",
                "老移动端推送通知记录：接收手机号(JSZ)/发送者(FSZ)/提示音(SYWJ)/已读标志(YDF)/阅读时间(YDSJ)");
        TABLE_HEAD.put("s_sys",
                "老面板引擎的「画面字段元数据表」= yj_field 的前身：241 个画面，含 CHS/CHT/ENG/OTH 四语标签"
                        + "（老字段中文名+多语言译名的唯一存底）");
        TABLE_HEAD.put("s_xtcs",
                "老系统参数（报工自动打印/是否允许负库存/报工前必须领料/税额小数位…），现由 yj_app_setting 承接");

        FILE_ONLY_COMMENTS.put("dm_langue.xc", "行序");
        FILE_ONLY_COMMENTS.put("dm_langue.bz", "备注");
        FILE_ONLY_COMMENTS.put("gscs.bz", "备注");
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 5) {
            System.err.println("usage: ExportLegacyTables <host> <db> <user> <pass> <outDir>");
            System.exit(2);
        }
        String host = args[0], db = args[1], user = args[2], pass = args[3];
        Path outDir = Paths.get(args[4]);
        if (!Files.isDirectory(outDir)) throw new IllegalArgumentException("outDir not found: " + outDir);

        String url = "jdbc:sqlserver://" + host + ";databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=30;applicationName=legacy-archive-export";
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");

        List<String> report = new ArrayList<>();
        StringBuilder schema = new StringBuilder(schemaHeader(db, host, LocalDate.now().toString()));
        boolean allOk = true;

        try (Connection cn = DriverManager.getConnection(url, user, pass)) {
            for (String t : TABLES) {
                long rows;
                int cols;
                Path csv = outDir.resolve(t + ".csv");
                try (Statement st = cn.createStatement();
                     ResultSet rs = st.executeQuery("SELECT * FROM dbo.[" + t + "] ORDER BY [" + ORDER_BY.get(t) + "]")) {
                    ResultSetMetaData md = rs.getMetaData();
                    cols = md.getColumnCount();
                    try (Writer w = new OutputStreamWriter(
                            Files.newOutputStream(csv, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING,
                                    StandardOpenOption.WRITE), StandardCharsets.UTF_8)) {
                        w.write('\ufeff');
                        for (int i = 1; i <= cols; i++) {
                            if (i > 1) w.write(',');
                            w.write(csvField(md.getColumnName(i)));
                        }
                        w.write("\r\n");
                        rows = 0;
                        while (rs.next()) {
                            for (int i = 1; i <= cols; i++) {
                                if (i > 1) w.write(',');
                                String v = rs.getString(i);
                                if (v != null) w.write(csvField(v));
                            }
                            w.write("\r\n");
                            rows++;
                        }
                    }
                }
                boolean rowsOk = rows == EXPECTED_ROWS.get(t);
                boolean colsOk = cols == EXPECTED_COLS.get(t);
                allOk &= rowsOk && colsOk;
                report.add(String.format("%-11s cols=%2d(%s) rows=%6d(%s) bytes=%9d",
                        t, cols, colsOk ? "ok" : "MISMATCH", rows, rowsOk ? "ok" : "MISMATCH", Files.size(csv)));

                schema.append(createTableBlock(cn, t, rows));
            }
        }

        schema.append(schemaFooter());
        Path sp = outDir.resolve("schema.sql");
        Files.write(sp, ("\ufeff" + schema).getBytes(StandardCharsets.UTF_8));
        report.add(String.format("%-11s (schema.sql) bytes=%9d", "-", Files.size(sp)));

        System.out.println(String.join(System.lineSeparator(), report));
        System.out.println(allOk ? "SELFCHECK: rows/cols all match" : "SELFCHECK: MISMATCH PRESENT");
        if (!allOk) System.exit(1);
    }

    // ---------------------------------------------------------------- CSV

    static String csvField(String v) {
        boolean quote = v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0;
        if (!quote && !v.isEmpty()) {
            quote = Character.isWhitespace(v.charAt(0)) || Character.isWhitespace(v.charAt(v.length() - 1));
        }
        if (!quote) return v;
        return '"' + v.replace("\"", "\"\"") + '"';
    }

    // ------------------------------------------------------------- schema

    static String schemaHeader(String db, String host, String date) {
        return ""
                + "-- ============================================================================\n"
                + "-- schema.sql —— 6 张已删除遗留表的【结构留档】（表数据见同目录 *.csv）\n"
                + "--\n"
                + "-- 来源库   : " + db + "（实例 " + host + "）\n"
                + "--            该库是 2026-09-10 从 HSDZ_MES_damaged_20260910.bak 恢复的快照库（294 张表）。\n"
                + "--            这 6 张表在正式库 HSDZ_MES 与测试库 HSDZ_MES_TEST 已于 2026-09-29\n"
                + "--            「未用表清理」中删除（共清 244 张），目前仅该快照库仍保留。\n"
                + "-- 生成方式 : _export-legacy-tables.java 直读系统目录视图——\n"
                + "--            列名/类型/长度/精度/可空性取自 sys.columns + sys.types，\n"
                + "--            IDENTITY 种子与步长取自 sys.identity_columns，\n"
                + "--            中文注释取自 sys.extended_properties(MS_Description)。全部实测，非人工臆测。\n"
                + "-- 生成日期 : " + date + "\n"
                + "--\n"
                + "-- 中文注释来源: 这些表在 HSDZ_MES_0909 里自身的 MS_Description；已逐条与\n"
                + "--   deploy/sync-db-comments.sql 比对：该文件对这 6 张表收录的注释与实测值【无一条文本不符】，\n"
                + "--   其多出的 3 条（dm_langue.xc / dm_langue.bz / gscs.bz，实测库中无该扩展属性）也已保留并标注。\n"
                + "--   ⚠ dm_langue 的表注释「语言（作废）」与实测数据不符，本文件按事实写成\n"
                + "--     「微信/移动端在线用户表」，原始注释保留在表头说明里备查。\n"
                + "--\n"
                + "-- ⚠⚠ 这是留档 / 复原脚本，只适用于临时库或新库：\n"
                + "--    ✗ 不要 在 HSDZ_MES / HSDZ_MES_TEST 上执行 —— 那两张库已把 244 张未用表清干净，\n"
                + "--      跑它等于把其中这 6 张又塞回去，破坏 tools/db-inuse-tables.txt 台账与\n"
                + "--      docs/development/数据库表清单.md 的登记。\n"
                + "--    ✓ 正确用法：CREATE DATABASE <临时库> → 对该临时库执行本脚本 → 只为比对/取数，用完即删。\n"
                + "--    ✓ 幂等：每张表都套 IF OBJECT_ID(N'dbo.xxx', N'U') IS NULL，重复执行不会覆盖/重建已有表。\n"
                + "-- ============================================================================\n\n";
    }

    static String createTableBlock(Connection cn, String t, long rows) throws SQLException {
        StringBuilder sb = new StringBuilder();
        sb.append("-- ----------------------------------------------------------------------------\n");
        sb.append("-- ").append(t).append(" —— ").append(TABLE_HEAD.get(t)).append("\n");
        sb.append("-- HSDZ_MES_0909 实测行数：").append(rows).append("\n");
        sb.append("-- ----------------------------------------------------------------------------\n");
        sb.append("IF OBJECT_ID(N'dbo.").append(t).append("', N'U') IS NULL\n");
        sb.append("BEGIN\n");
        sb.append("CREATE TABLE dbo.[").append(t).append("] (\n");

        Map<String, String> comments = commentsOf(cn, t);
        String sql = "SELECT c.name AS col, ty.name AS typ, c.max_length AS len, c.precision AS prec, c.scale AS scl, "
                + "c.is_nullable AS nullable, ic.seed_value AS seed, ic.increment_value AS incr, c.column_id AS ord "
                + "FROM sys.columns c "
                + "JOIN sys.types ty ON ty.user_type_id = c.user_type_id "
                + "LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id "
                + "WHERE c.object_id = OBJECT_ID(N'dbo.' + ?) ORDER BY c.column_id";

        List<String> cols = new ArrayList<>();
        List<String> names = new ArrayList<>();
        try (PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setString(1, t);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String name = rs.getString("col");
                    String typ = rs.getString("typ");
                    int len = rs.getInt("len");
                    int prec = rs.getInt("prec");
                    int scl = rs.getInt("scl");
                    boolean nullable = rs.getBoolean("nullable");
                    String seed = rs.getString("seed");

                    StringBuilder line = new StringBuilder();
                    line.append("    [").append(name).append("] ").append(sqlType(typ, len, prec, scl));
                    if (seed != null) {
                        line.append(" IDENTITY(").append(seed).append(",").append(rs.getString("incr")).append(")");
                    }
                    line.append(nullable ? " NULL" : " NOT NULL");
                    cols.add(line.toString());
                    names.add(name);
                }
            }
        }

        for (int i = 0; i < cols.size(); i++) {
            String name = names.get(i);
            StringBuilder line = new StringBuilder(cols.get(i));
            if (i < cols.size() - 1) line.append(",");
            String c = comments.get(name);
            String note = null;
            if (c != null) {
                note = c;
            } else if (FILE_ONLY_COMMENTS.containsKey(t + "." + name)) {
                note = FILE_ONLY_COMMENTS.get(t + "." + name) + "（注释仅见于 deploy/sync-db-comments.sql）";
            }
            if (note != null) {
                int pad = 48 - line.length();
                line.append(" ".repeat(Math.max(2, pad))).append("-- ").append(note);
            }
            sb.append(line).append("\n");
        }
        sb.append(");\n");
        sb.append("END;\n");
        sb.append("GO\n\n");
        return sb.toString();
    }

    /** 中文注释：HSDZ_MES_0909 的 MS_Description（表注释的 key 为 "(TABLE)"） */
    static Map<String, String> commentsOf(Connection cn, String t) throws SQLException {
        Map<String, String> m = new HashMap<>();
        String sql = "SELECT ISNULL(COL_NAME(ep.major_id, ep.minor_id), '(TABLE)') AS col, "
                + "CAST(ep.value AS nvarchar(500)) AS descr FROM sys.extended_properties ep "
                + "WHERE ep.name = N'MS_Description' AND ep.major_id = OBJECT_ID(N'dbo.' + ?)";
        try (PreparedStatement ps = cn.prepareStatement(sql)) {
            ps.setString(1, t);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) m.put(rs.getString("col"), rs.getString("descr"));
            }
        }
        return m;
    }

    static String sqlType(String typ, int len, int prec, int scl) {
        switch (typ.toLowerCase()) {
            case "varchar":
            case "char":
            case "varbinary":
            case "binary":
                return typ + (len == -1 ? "(MAX)" : "(" + len + ")");
            case "nvarchar":
            case "nchar":
                return typ + (len == -1 ? "(MAX)" : "(" + (len / 2) + ")");
            case "decimal":
            case "numeric":
                return typ + "(" + prec + "," + scl + ")";
            case "datetime2":
            case "datetimeoffset":
            case "time":
                return typ + "(" + scl + ")";
            default:
                return typ;
        }
    }

    static String schemaFooter() {
        return ""
                + "-- ============================================================================\n"
                + "-- 已知注释疑点（本文件保留原始注释不改写，仅在此备注）\n"
                + "--   1) dm_langue 的表注释「语言（作废）」—— 错。实测 frm 是微信ID/手机号（长度 11~28）、\n"
                + "--      lb_wi 是在线标志（15 行全为 1）、asp_time1 是登录时间 ⇒ 真身是微信/移动端在线用户表。\n"
                + "--      本文件表头已按事实注明。\n"
                + "--   2) s_sys.LB_LEFT 的注释「小数位数」—— 与同组 LB_TOP/LB_WI/LB_HI（上坐标/宽度/高度）不搭，\n"
                + "--      且实测取值 0~200，更像「左坐标」；疑为 deploy/sync-db-comments.sql 的错位注释。\n"
                + "--      本文件按原样保留该注释，仅此备注，未擅自改写。\n"
                + "-- ============================================================================\n";
    }
}
