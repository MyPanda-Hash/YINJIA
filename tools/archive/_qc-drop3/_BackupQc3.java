import java.sql.*;
import java.util.*;

/**
 * _BackupQc3.java — 「成型检验单 / 切炭检验单 / 成品检验规范」三张面板下架前的**回退抓手**备份器。
 *
 * 用法(tools 目录,JDK 25 源文件模式):
 *   java -cp lib\mssql-jdbc.jar archive\_qc-drop3\_BackupQc3.java <jdbcUrl> <user> <pass|env> <outDir>
 *
 * 产出(全部 UTF-8):
 *   restore-metadata.sql   —— yj_panel / yj_field / yj_role_panel / yj_translation(仅该 3 面板)的 INSERT
 *   data.sql               —— 6 张业务表的全部行 INSERT(下架会连数据一起删,这是唯一留底)
 *   tables-ddl.sql         —— 6 张表的 CREATE TABLE 重建(列/类型/可空/默认,够还原)
 *   columns.tsv            —— 6 张表 + 元数据表的列清单(人看)
 *   rowcounts.txt          —— 每表行数(与迁移脚本执行前的自检对账)
 */
public class _BackupQc3 {

    /** 面板编码 → 面板名(中文,数据键一律中文) */
    static final Map<String, String> PANELS = new LinkedHashMap<>() {{
        put("QC_MOLD_INSP", "成型检验单");
        put("QC_CUT_INSP", "切炭检验单");
        put("QC_FIN_SPEC", "成品检验规范");
    }};

    /** 业务表(下架即删,数据必须先落盘) */
    static final String[] DATA_TABLES = {
            "qc_mold_insp_head", "qc_mold_insp_detail",
            "qc_cut_insp_head", "qc_cut_insp_detail",
            "qc_fin_spec_head", "qc_fin_spec_detail",
    };

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("用法: _BackupQc3 <jdbcUrl> <user> <pass|env> <outDir>");
            System.exit(2);
        }
        String url = args[0], user = args[1];
        String pass = args[2].equals("env") ? System.getenv("YINJIA_SQL_PASS") : args[2];
        java.nio.file.Path out = java.nio.file.Path.of(args[3]);
        java.nio.file.Files.createDirectories(out);

        StringBuilder meta = new StringBuilder(header("元数据备份", url));
        StringBuilder data = new StringBuilder(header("业务数据备份", url));
        StringBuilder ddl = new StringBuilder(header("表结构重建", url));
        StringBuilder cols = new StringBuilder("table\tcolumn\ttype\tnullable\tmaxlen\n");
        StringBuilder counts = new StringBuilder("table\trows\n");

        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[connected] " + c.getMetaData().getURL());

            // ── 1 元数据 ─────────────────────────────────────────────
            String codes = "'QC_MOLD_INSP','QC_CUT_INSP','QC_FIN_SPEC'";
            dump(c, meta, "SELECT * FROM dbo.yj_panel WHERE panel_code IN (" + codes + ") ORDER BY panel_code");
            dump(c, meta, "SELECT * FROM dbo.yj_field WHERE panel_code IN (" + codes + ") ORDER BY panel_code, seq, id");
            dump(c, meta, "SELECT * FROM dbo.yj_role_panel WHERE panel_code IN (" + codes + ") ORDER BY panel_code");
            // 译名:面板名 + 这三张面板的字段标签(同标签可能被别处在用 ⇒ 只备份不判定)
            String names = PANELS.values().stream().map(n -> "N'" + n + "'").reduce((a, b) -> a + "," + b).get();
            dump(c, meta, "SELECT * FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key IN (" + names + ") ORDER BY ref_key, locale");
            dump(c, meta, "SELECT * FROM dbo.yj_translation WHERE scope = 'field' AND ref_key IN ("
                    + "SELECT DISTINCT label FROM dbo.yj_field WHERE panel_code IN (" + codes + "))"
                    + " ORDER BY ref_key, locale");
            // 单据状态
            dump(c, meta, "SELECT * FROM dbo.yj_doc_status WHERE panel_code IN (" + codes + ") ORDER BY panel_code, id");

            // ── 2 业务数据 + 行数 + DDL + 列清单 ──────────────────────
            for (String t : DATA_TABLES) {
                long n = count(c, t);
                counts.append(t).append('\t').append(n).append('\n');
                if (n > 0) dump(c, data, "SELECT * FROM dbo." + t);
                ddl.append(createTable(c, t)).append("\nGO\n\n");
                cols.append(columns(c, t));
                System.out.printf("  %-24s %5d rows%n", t, n);
            }
        }

        write(out.resolve("restore-metadata.sql"), meta);
        write(out.resolve("data.sql"), data);
        write(out.resolve("tables-ddl.sql"), ddl);
        write(out.resolve("columns.tsv"), cols);
        write(out.resolve("rowcounts.txt"), counts);
        System.out.println("[OK] 备份落盘: " + out.toAbsolutePath());
    }

    static String header(String what, String url) {
        return "-- " + what + "(「成型检验单 QC_MOLD_INSP / 切炭检验单 QC_CUT_INSP / 成品检验规范 QC_FIN_SPEC」下架备份)\n"
                + "-- 来源库: " + url + "\n"
                + "-- 生成工具: tools/archive/_qc-drop3/_BackupQc3.java   备份时间: " + new java.util.Date() + "\n"
                + "-- 回退:先跑 tables-ddl.sql 重建表,再跑 restore-metadata.sql 与 data.sql(全幂等由人工确认后执行)\n\n";
    }

    static void write(java.nio.file.Path p, CharSequence cs) throws Exception {
        java.nio.file.Files.writeString(p, cs.toString(), java.nio.charset.StandardCharsets.UTF_8);
    }

    static long count(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo." + table)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    /** 通用「表 → INSERT 语句」导出(类型感知:数值裸写、时间/N 型加引号、NULL 原样) */
    static void dump(Connection c, StringBuilder sb, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            String table = tableOf(sql);
            sb.append("-- ").append(sql).append('\n');
            while (rs.next()) {
                sb.append("INSERT INTO dbo.").append(table).append(" (");
                for (int i = 1; i <= n; i++) sb.append(i > 1 ? ", " : "").append('[').append(md.getColumnLabel(i)).append(']');
                sb.append(") VALUES (");
                for (int i = 1; i <= n; i++) {
                    sb.append(i > 1 ? ", " : "").append(literal(rs, md, i));
                }
                sb.append(");\n");
            }
            sb.append('\n');
        }
    }

    static String tableOf(String sql) {
        // FROM dbo.xxx [WHERE ...]
        String s = sql.substring(sql.indexOf("dbo.") + 4);
        int sp = s.indexOf(' ');
        return sp < 0 ? s : s.substring(0, sp);
    }

    static String literal(ResultSet rs, ResultSetMetaData md, int i) throws SQLException {
        Object v = rs.getObject(i);
        if (v == null || rs.wasNull()) return "NULL";
        int type = md.getColumnType(i);
        switch (type) {
            case Types.INTEGER: case Types.BIGINT: case Types.SMALLINT: case Types.TINYINT:
            case Types.DECIMAL: case Types.NUMERIC: case Types.FLOAT: case Types.REAL:
            case Types.DOUBLE:
                return rs.getString(i);
            case Types.BIT:
            case Types.BOOLEAN:
                return rs.getBoolean(i) ? "1" : "0";
            case Types.DATE:
                return "'" + rs.getDate(i) + "'";
            case Types.TIMESTAMP: case Types.TIMESTAMP_WITH_TIMEZONE: {
                Timestamp ts = rs.getTimestamp(i);
                return "'" + ts.toString() + "'";
            }
            case Types.BINARY: case Types.VARBINARY: case Types.LONGVARBINARY: {
                byte[] b = rs.getBytes(i);
                StringBuilder h = new StringBuilder("0x");
                for (byte x : b) h.append(String.format("%02X", x));
                return h.toString();
            }
            default:
                return "N'" + rs.getString(i).replace("'", "''") + "'";
        }
    }

    /** 用 sys.columns/sys.types 重建 CREATE TABLE(够还原;索引/约束不重建) */
    static String createTable(Connection c, String table) throws SQLException {
        StringBuilder sb = new StringBuilder("IF OBJECT_ID(N'dbo." + table + "', N'U') IS NULL\nCREATE TABLE dbo.["
                + table + "] (\n");
        String sql = "SELECT c.name AS col, t.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, "
                + "OBJECT_DEFINITION(c.default_object_id) AS def "
                + "FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id "
                + "WHERE c.object_id = OBJECT_ID('dbo." + table + "') ORDER BY c.column_id";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            boolean first = true;
            while (rs.next()) {
                if (!first) sb.append(",\n");
                first = false;
                String typ = rs.getString("typ");
                int maxLen = rs.getInt("max_length");
                String len;
                switch (typ) {
                    case "nvarchar": len = maxLen < 0 ? "(max)" : "(" + (maxLen / 2) + ")"; break;
                    case "varchar": case "char": case "nchar": case "varbinary": case "binary":
                        len = maxLen < 0 ? "(max)" : "(" + maxLen + ")"; break;
                    case "decimal": case "numeric":
                        len = "(" + rs.getInt("precision") + "," + rs.getInt("scale") + ")"; break;
                    default: len = "";
                }
                sb.append("  [").append(rs.getString("col")).append("] ").append(typ).append(len);
                if (rs.getBoolean("is_identity")) sb.append(" IDENTITY(1,1)");
                sb.append(rs.getBoolean("is_nullable") ? " NULL" : " NOT NULL");
                String def = rs.getString("def");
                if (def != null) sb.append(" DEFAULT ").append(def);
            }
        }
        sb.append("\n);\nPRINT N'").append(table).append(" 就绪';");
        return sb.toString();
    }

    static String columns(Connection c, String table) throws SQLException {
        StringBuilder sb = new StringBuilder();
        String sql = "SELECT c.name AS col, t.name AS typ, c.is_nullable, c.max_length "
                + "FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id "
                + "WHERE c.object_id = OBJECT_ID('dbo." + table + "') ORDER BY c.column_id";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                sb.append(table).append('\t').append(rs.getString("col")).append('\t').append(rs.getString("typ"))
                        .append('\t').append(rs.getBoolean("is_nullable") ? "NULL" : "NOT NULL")
                        .append('\t').append(rs.getInt("max_length")).append('\n');
            }
        }
        return sb.toString();
    }
}
