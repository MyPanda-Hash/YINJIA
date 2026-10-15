import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

/**
 * _GenLegacyDdl.java — 从「服务器快照库」生成 6 张经典 HSDZ 遗留表的**只建表迁移脚本**(不含数据)。
 *
 * 为什么只出 DDL:这几张表的行数据含真实手机号(s_commdata.JSZ)与公司电话(gscs),
 *   按 AGENTS.md「敏感信息不入库」不得写进 git;数据由 tools/archive/_migration-gap-20261017/
 *   _restore-legacy-data.sql 从快照一次性回灌(本机专属,不进链)。
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
    // 说明文字里出现全角括号会在 RAISERROR 里被当格式符吗?不会 —— 但 % 会,故一律不写 %。

    static final String SRC = "HSDZ_MES_SRV1015";

    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + SRC + ";encrypt=false;loginTimeout=10";
        StringBuilder sb = new StringBuilder();
        sb.append("""
                /* migrate-legacy-restore-20261017.sql — 把「服务器快照」里的 6 张经典 HSDZ 遗留表补回账套
                 *
                 * 【用户口径 2026-10-17】
                 *   「当前服务器快照缺失的表需要补充回到当前的数据库内,数据也按照服务器快照完成恢复」
                 *   —— 本脚本负责**建表 + 中文注明**;两账套(先正式后测试)均执行。
                 *
                 * 【为什么是这 6 张】
                 *   与快照库 HSDZ_MES_SRV1015 逐表比对,正式库 HSDZ_MES 缺 14 张,分三类:
                 *     ① 6 张经典遗留(本脚本):dm_langue / gscs / permission / s_commdata / s_sys / s_xtcs
                 *     ② 6 张 2026-10-16 **主动下架**的检验单(另案处理,不在本脚本)
                 *     ③ 2 张 *_bak_ 备份表(不补 —— AGENTS.md 明确 * 星号 bak 类棘轮基线必须为 0,补了体检 FAIL)
                 *   这 6 张在后端源码里**只出现在注释中**(「对齐 HSDZ permission.GROP」),
                 *   运行期零引用 ⇒ 补回来不改任何行为,纯粹是把经典 HSDZ 的资产恢复齐全。
                 *
                 * 【数据怎么办 —— 本脚本**不灌数据**,这是有意的】
                 *   快照里这 6 张表共 7,936 行,其中 s_commdata.JSZ 是**真实手机号**、gscs 是公司电话,
                 *   按 AGENTS.md「敏感信息不入库(.env、AK/密码 —— 提交前 git grep 扫一遍)」不得写进 git。
                 *   数据由 tools/archive/_migration-gap-20261017/_restore-legacy-data.sql 从快照库
                 *   一次性回灌(带 DB_ID 守卫 + 空表守卫,幂等;仅本机可行,故意不进清单)。
                 *
                 * 【幂等】IF OBJECT_ID IS NULL CREATE TABLE;注明 NOT EXISTS 才加。重跑为 no-op。
                 * 【登记】tools/db-inuse-tables.txt(例外保留·快照回补) + tools/db-legacy-whitelist.txt(table: 冻结)。
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
                sb.append(createTable(c, t.name())).append("\nGO\n\n");
                long n = count(c, t.name());
                System.out.printf("  %-14s %6d 列  %7d 行(数据不写入本脚本)%n", t.name(), cols(c, t.name()), n);
            }
            sb.append("/* ===== 表级中文注明(MS_Description;已存在则不覆盖) ===== */\n");
            for (T t : TABLES) {
                sb.append("IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id\n")
                  .append("               WHERE tb.name = N'").append(t.name()).append("' AND ep.name = N'MS_Description' AND ep.minor_id = 0)\n")
                  .append("  EXEC sp_addextendedproperty N'MS_Description', N'")
                  .append(t.desc().replace("'", "''")).append("', N'SCHEMA', N'dbo', N'TABLE', N'").append(t.name()).append("';\n");
            }
            sb.append("GO\n\n/* ===== 自检 ===== */\n");
            sb.append("DECLARE @bad int = 0, @msg nvarchar(400) = N'';\n");
            for (T t : TABLES) {
                sb.append("IF OBJECT_ID(N'dbo.").append(t.name()).append("', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'").append(t.name()).append(" '; END\n");
            }
            // ⚠ RAISERROR 的参数只能是**变量**:塞 DB_NAME() 这类表达式会报
            //   「Incorrect syntax near 'DB_NAME'」(AGENTS.md 记过的坑,本轮踩过一次)。先取变量再传。
            sb.append("DECLARE @dbn sysname = DB_NAME();\n");
            sb.append("RAISERROR(N'[自检] %s:6 张遗留表,缺失 %d 张 %s', 10, 1, @dbn, @bad, @msg);\n");
            sb.append("IF @bad = 0 RAISERROR(N'[OK] 6 张经典 HSDZ 遗留表已就位(dm_langue/gscs/permission/s_commdata/s_sys/s_xtcs)', 10, 1);\n");
            sb.append("ELSE RAISERROR(N'[FAIL] 遗留表补齐不完整', 16, 1);\nGO\n");
        }

        Path out = Path.of("migrate-legacy-restore-20261017.sql");
        Files.writeString(out, sb.toString(), StandardCharsets.UTF_8);
        System.out.println("[OK] 已写出 " + out.toAbsolutePath() + "  (" + sb.length() + " 字符)");
    }

    static long count(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo." + table)) {
            rs.next(); return rs.getLong(1);
        }
    }

    static int cols(Connection c, String table) throws SQLException {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo." + table + "')")) {
            rs.next(); return rs.getInt(1);
        }
    }

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
                    case "nvarchar" -> len = maxLen < 0 ? "(max)" : "(" + (maxLen / 2) + ")";
                    case "varchar", "char", "nchar", "varbinary", "binary" -> len = maxLen < 0 ? "(max)" : "(" + maxLen + ")";
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
}
