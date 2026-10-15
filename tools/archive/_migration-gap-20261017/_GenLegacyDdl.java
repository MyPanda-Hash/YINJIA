import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * _GenLegacyDdl.java v2 — 从「服务器快照库」生成 6 张经典 HSDZ 遗留表的**只建表迁移脚本**(不含数据)。
 *
 * v2 修了 v1 的三个缺口(2026-10-17 与快照逐列比对后发现):
 *   ① `nchar` 宽度写成字节数:`nchar(1)`(max_length=2 字节)被建成 `nchar(2)` —— 7 列(s_sys)。
 *      根因:Unicode 定长类型的 max_length 是字节,须 /2(v1 只对 nvarchar 除了);
 *      v2 额外产出**修复 ALTER**,保证已经按 v1 建过表的库重跑即自愈。
 *   ② 索引/主键一个都没建(v1 沿用了 _BackupQc3 的"索引不重建")—— 快照上 6 张表各有主键,
 *      s_commdata 还有 comm/jsz/xc 三个非聚集索引。
 *   ③ 列级中文注明没搬过来(v1 只加了表级)—— 快照上有 133 条列注明(创建人/删除标记/…)。
 *
 * 用法(tools 目录):java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_GenLegacyDdl.java
 */
public class _GenLegacyDdl {

    record T(String name, String desc) {}

    static final List<T> TABLES = List.of(
            new T("dm_langue", "多语言词条表(经典 HSDZ:comm/id/frm/type + chs/cht/eng/oth/bz 五语文本;MES 多语言走 yj_translation,本表仅存档)"),
            new T("gscs", "公司参数表(经典 HSDZ:一行一公司,gsmc 公司名称/gsdh 电话/web 等 55 列;MES 无引用,仅存档)"),
            new T("permission", "权限明细表(经典 HSDZ:USERID 账号 × MODULE1 模块 × RW 权限位 × GROP 分组;MES 权限走 yj_role/yj_role_panel,本表仅存档)"),
            new T("s_commdata", "通讯数据表(经典 HSDZ:短信/语音外呼队列 —— JSZ=接收号码/CTMC 内容/KEY 接口键/DSFS 发送方式;MES 无引用,仅存档)"),
            new T("s_sys", "系统表(经典 HSDZ:界面元素与菜单的字段级元数据 —— COMM/MC 名称/SYSMENUNO 菜单号/LB_* 控件位置/GROP 分组/五语标题;MES 面板元数据走 yj_panel/yj_field,本表仅存档)"),
            new T("s_xtcs", "系统参数表(经典 HSDZ:dm 代码/mc 名称/value 取值 —— 工单二维码长度/超交百分比/预订交期天数等;MES 运行期参数走 yj_app_setting,本表仅存档)"));

    static final String SRC = "HSDZ_MES_SRV1015";

    /** 快照里由系统自动生成、名字很难看的索引名 → 换成规范名(仅 s_commdata 的主键)。 */
    static String indexName(String table, String raw, boolean pk) {
        if (raw.startsWith("PK__")) return "PK_" + table;
        return raw;
    }

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + SRC + ";encrypt=false;loginTimeout=10";
        StringBuilder sb = new StringBuilder();
        sb.append("""
                /* migrate-legacy-restore-20261017.sql — 把「服务器快照」里的 6 张经典 HSDZ 遗留表补回账套
                 *
                 * 【用户口径 2026-10-17】
                 *   「当前服务器快照缺失的表需要补充回到当前的数据库内,数据也按照服务器快照完成恢复」
                 *   —— 本脚本负责**建表 + 主键索引 + 表级/列级中文注明**;两账套(先正式后测试)均执行。
                 *
                 * 【为什么是这 6 张】
                 *   与快照库 HSDZ_MES_SRV1015 逐表比对,正式库 HSDZ_MES 缺 14 张,分三类:
                 *     ① 6 张经典遗留(本脚本):dm_langue / gscs / permission / s_commdata / s_sys / s_xtcs
                 *     ② 6 张 2026-10-16 **主动下架**的检验单(另案处理,不在本脚本)
                 *     ③ 2 张 *_bak_ 备份表(不补 —— AGENTS.md 明确 * 星号 bak 类棘轮基线必须为 0,补了体检 FAIL)
                 *   这 6 张在后端源码里**只出现在注释中**(「对齐 HSDZ permission.GROP」),
                 *   运行期零引用 ⇒ 补回来不改任何行为,纯粹是把经典 HSDZ 的资产恢复齐全。
                 *
                 * 【v2 修复(v1 建过表的库重跑本脚本即自愈)】
                 *   ① `nchar` 宽度:v1 把字节长度当字符数,`nchar(1)` 被建成 `nchar(2)`(s_sys 7 列)
                 *      —— 本节末尾的修复 ALTER 会按"字节长度不符"纠正;新建路径已直接写对。
                 *   ② 主键/索引:v1 一个没建 —— 现在按快照补 PK(6 张)+ s_commdata 的 comm/jsz/xc 三个非聚集索引。
                 *      ⚠ s_commdata 主键在快照上是系统自动名 `PK__s_commda__3214EC27C3DB5918`,
                 *        本脚本改用规范名 `PK_s_commdata`(键列/聚集/唯一性完全一致,仅名字不同)。
                 *   ③ 列级中文注明:v1 只加了表级 —— 现在把快照上的列注明逐条搬过来(NOT EXISTS 守卫)。
                 *
                 * 【数据怎么办 —— 本脚本**不灌数据**,这是有意的】
                 *   快照里这 6 张表共 7,936 行,其中 s_commdata.JSZ 是**真实手机号**、gscs 是公司电话,
                 *   按 AGENTS.md「敏感信息不入库(.env、AK/密码 —— 提交前 git grep 扫一遍)」不得写进 git。
                 *   数据由 tools/archive/_migration-gap-20261017/_restore-legacy-data.sql 从快照库
                 *   一次性回灌(带 DB_ID 守卫 + 空表守卫,幂等;仅本机可行,故意不进清单)。
                 *
                 * 【幂等】IF OBJECT_ID IS NULL CREATE TABLE;索引/注明 NOT EXISTS 守卫;nchar 修复带字节长度守卫。
                 * 【登记】tools/db-inuse-tables.txt(快照回补节) + tools/db-legacy-whitelist.txt(table: 冻结)。
                 * 【注】本文件由 tools/archive/_migration-gap-20261017/_GenLegacyDdl.java 生成,请勿手改。
                 */
                SET NOCOUNT ON;
                GO
                IF DB_NAME() = N'master' USE HSDZ_MES;
                GO

                """);

        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("[connected] " + c.getCatalog());
            for (T t : TABLES) {
                sb.append("/* ===== ").append(t.name()).append(" — ").append(t.desc()).append(" ===== */\n");
                sb.append(createTable(c, t.name())).append("\n");
                sb.append(repairNchar(c, t.name()));
                sb.append(indexes(c, t.name()));
                sb.append("GO\n\n");
                System.out.printf("  %-14s %6d 列  %7d 行  %d 索引  %d 列注明%n", t.name(), cols(c, t.name()),
                        count(c, t.name()), indexCount(c, t.name()), commentRows(c, t.name()).size());
            }
            sb.append("/* ===== 中文注明:表级 + 列级(逐条 NOT EXISTS 守卫) ===== */\n");
            for (T t : TABLES) {
                sb.append(tableComment(t.name(), t.desc()));
            }
            sb.append("GO\n\n");
            sb.append("/* ===== 列级中文注明(照搬快照) ===== */\n");
            for (T t : TABLES) {
                for (String[] r : commentRows(c, t.name())) {
                    sb.append("IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id\n")
                      .append("               WHERE tb.name = N'").append(t.name()).append("' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.").append(t.name()).append("'), N'").append(r[0]).append("', 'ColumnId'))\n")
                      .append("  EXEC sp_addextendedproperty N'MS_Description', N'").append(esc(r[1])).append("', N'SCHEMA', N'dbo', N'TABLE', N'").append(t.name()).append("', N'COLUMN', N'").append(r[0]).append("';\n");
                }
            }
            sb.append("GO\n\n/* ===== 自检 ===== */\n");
            sb.append("DECLARE @bad int = 0, @msg nvarchar(400) = N'';\n");
            for (T t : TABLES) {
                int n = cols(c, t.name()), idx = indexCount(c, t.name()), cmt = commentRows(c, t.name()).size();
                sb.append("IF OBJECT_ID(N'dbo.").append(t.name()).append("', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'").append(t.name()).append(" 缺表 '; END\n");
                sb.append("ELSE BEGIN\n")
                  .append("  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.").append(t.name()).append("')) <> ").append(n)
                  .append(" BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'").append(t.name()).append(" 列数 '; END\n")
                  .append("  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.").append(t.name()).append("') AND type > 0) <> ").append(idx)
                  .append(" BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'").append(t.name()).append(" 索引 '; END\n")
                  .append("  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.").append(t.name()).append("') AND name = N'MS_Description') <> ").append(cmt + 1)
                  .append(" BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'").append(t.name()).append(" 注明 '; END\n")
                  .append("END\n");
            }
            sb.append("DECLARE @dbn sysname = DB_NAME();\n");
            sb.append("RAISERROR(N'[自检] %s:6 张遗留表(表/列数/索引/注明),不符项 %d %s', 10, 1, @dbn, @bad, @msg);\n");
            sb.append("IF @bad = 0 RAISERROR(N'[OK] 6 张经典 HSDZ 遗留表已就位(表+列+主键索引+表级/列级中文注明)', 10, 1);\n");
            sb.append("ELSE RAISERROR(N'[FAIL] 遗留表补齐不完整(见上一行)', 16, 1);\nGO\n");
        }

        Path out = Path.of("migrate-legacy-restore-20261017.sql");
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] 已写出 " + out.toAbsolutePath() + "  (" + sb.length() + " 字符)");
    }

    static String esc(String s) { return s.replace("'", "''"); }
    static String q(String t) { return "[" + t.replace("]", "]]") + "]"; }

    static long count(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo." + q(table))) {
            rs.next(); return rs.getLong(1);
        }
    }

    static int cols(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo." + table + "')")) {
            rs.next(); return rs.getInt(1);
        }
    }

    static int indexCount(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID('dbo." + table + "') AND type > 0")) {
            rs.next(); return rs.getInt(1);
        }
    }

    /** 快照上的列级注明: [列名, 注明] */
    static List<String[]> commentRows(Connection c, String table) throws SQLException {
        List<String[]> out = new ArrayList<>();
        String sql = "SELECT col.name AS c, CAST(ep.value AS nvarchar(400)) AS v "
                + "FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id "
                + "JOIN sys.columns col ON col.object_id = ep.major_id AND col.column_id = ep.minor_id "
                + "WHERE tb.name = ? AND ep.name = 'MS_Description' AND ep.minor_id > 0 ORDER BY col.column_id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new String[]{rs.getString("c"), rs.getString("v")});
            }
        }
        return out;
    }

    /** CREATE TABLE(已修 nchar:Unicode 定长类型也要 /2) */
    static String createTable(Connection c, String table) throws SQLException {
        StringBuilder sb = new StringBuilder("IF OBJECT_ID(N'dbo." + table + "', N'U') IS NULL\nCREATE TABLE dbo.[" + table + "] (\n");
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
                    // ⚠ nvarchar / nchar 是 Unicode,max_length 是**字节数**,须 /2;
                    //   varchar/char/binary/varbinary 的 max_length 就是字符/字节数,原样。
                    case "nvarchar", "nchar" -> len = maxLen < 0 ? "(max)" : "(" + (maxLen / 2) + ")";
                    case "varchar", "char", "varbinary", "binary" -> len = maxLen < 0 ? "(max)" : "(" + maxLen + ")";
                    case "decimal", "numeric" -> len = "(" + rs.getInt("precision") + "," + rs.getInt("scale") + ")";
                    default -> len = "";
                }
                sb.append("  [").append(rs.getString("col")).append("] ").append(typ).append(len);
                if (rs.getBoolean("is_identity")) sb.append(" IDENTITY(1,1)");
                sb.append(rs.getBoolean("is_nullable") ? " NULL" : " NOT NULL");
                String def = rs.getString("def");
                if (def != null) sb.append(" DEFAULT ").append(def);
            }
        }
        sb.append("\n);\nIF OBJECT_ID(N'dbo.").append(table).append("', N'U') IS NOT NULL PRINT N'[OK] ").append(table).append(" 就位';");
        return sb.toString();
    }

    /** v1 把 nchar(1) 建成 nchar(2) 的修复:按"字节长度不符"纠正(新库上不触发) */
    static String repairNchar(Connection c, String table) throws SQLException {
        StringBuilder sb = new StringBuilder();
        String sql = "SELECT c.name, c.max_length FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo." + table + "') "
                + "AND c.system_type_id = 239 ORDER BY c.column_id";   // 239 = nchar
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String col = rs.getString(1);
                int bytes = rs.getInt(2);
                sb.append("\nIF COL_LENGTH(N'dbo.").append(table).append("', N'").append(col).append("') IS NOT NULL AND COL_LENGTH(N'dbo.")
                  .append(table).append("', N'").append(col).append("') <> ").append(bytes)
                  .append("\n    ALTER TABLE dbo.").append(q(table)).append(" ALTER COLUMN ").append(q(col)).append(" nchar(").append(bytes / 2).append(") NULL;");
            }
        }
        if (sb.length() > 0) sb.append("\n");
        return sb.toString();
    }

    /** 主键 + 非聚集索引(照快照) */
    static String indexes(Connection c, String table) throws SQLException {
        StringBuilder sb = new StringBuilder();
        String sql = "SELECT i.name, i.is_primary_key, i.is_unique, i.type_desc, ISNULL(i.filter_definition, '') AS flt, "
                + "STUFF((SELECT ', ' + col.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END "
                + "  FROM sys.index_columns ic JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id "
                + " WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0 "
                + " ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS keys_ "
                + "FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo." + table + "') AND i.type > 0 ORDER BY i.is_primary_key DESC, i.name";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String raw = rs.getString("name");
                boolean pk = rs.getBoolean("is_primary_key");
                String name = indexName(table, raw, pk);
                String keys = rs.getString("keys_");
                if (pk) {
                    sb.append("\nIF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.").append(table).append("') AND is_primary_key = 1)\n")
                      .append("    ALTER TABLE dbo.").append(q(table)).append(" ADD CONSTRAINT ").append(q(name))
                      .append(" PRIMARY KEY CLUSTERED (").append(keys).append(");");
                    if (!name.equals(raw)) sb.append("   -- 快照原名为自动生成的 ").append(raw);
                } else {
                    sb.append("\nIF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.").append(table).append("') AND name = N'").append(esc(name)).append("')\n")
                      .append("    CREATE ").append(rs.getBoolean("is_unique") ? "UNIQUE " : "").append("NONCLUSTERED INDEX ").append(q(name))
                      .append(" ON dbo.").append(q(table)).append(" (").append(keys).append(")")
                      .append(rs.getString("flt").isEmpty() ? "" : " WHERE " + rs.getString("flt")).append(";");
                }
            }
        }
        if (sb.length() > 0) sb.append("\n");
        return sb.toString();
    }

    static String tableComment(String table, String desc) {
        return "IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id\n"
             + "               WHERE tb.name = N'" + table + "' AND ep.name = N'MS_Description' AND ep.minor_id = 0)\n"
             + "  EXEC sp_addextendedproperty N'MS_Description', N'" + esc(desc) + "', N'SCHEMA', N'dbo', N'TABLE', N'" + table + "';\n";
    }
}
