import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * YINJIA-MES 数据库一键初始化(替代 sqlcmd;绕过损坏的 Schannel,纯 JDBC)。
 * 在 SQL Server 单用户模式下以本地管理员(NTLM)连接:本地 Administrators 成员自动成为 sysadmin。
 *
 * 步骤:RESTORE HSDZ_MES 备份 -> 创建 yinjia 登录(db_datareader/writer/ddladmin)-> 按序执行全部脚本
 * 用法: java -cp <mssql-jdbc.jar> DbInit.java [bak路径]
 */
public class DbInit {
    static final String BASE = "D:\\YINJIA-main\\YINJIA-main\\tools\\";
    static final String[] SCRIPTS = {
        "setup-db.sql",
        "migrate-arch-single-doc.sql",
        "migrate-approval-flow.sql",
        "migrate-org-admin.sql",
        "fix-yj-user-id.sql",
        "migrate-role-perms.sql",
        "migrate-panel-modules.sql",
        "migrate-column-prefs.sql",
        "i18n-p3-labels.sql",
        "i18n-p3-updates.sql",
        "i18n-translation-table.sql",
        "i18n-fix-refkey.sql",
        "i18n-seed-languages.sql",
        "_bs_part1_tables.sql",
        "_bs_part2_meta.sql",
        "_bs_part3_data.sql",
        "_bs_part4_translations.sql",
        "cleanup-base-panels.sql",
        "_doc_part1_tables.sql",
        "_doc_part2_meta.sql",
        "_doc_part3_data.sql",
        "_doc_part4_translations.sql",
        "dispatch-reports.sql",
        "outsource-reports.sql",
        "fix-views-ultimate.sql",
        "fix-views-cancel.sql",
        "fix-zdgl-perf.sql",
        "fix-bsdict.sql",
    };

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "full";
        if (mode.equals("scripts")) {                    // 仅以 yinjia 执行脚本链(管理员阶段已完成)
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10",
                    "yinjia", "Yinjia@2026")) {
                System.out.println("[yinjia] connected: " + c.getMetaData().getUserName());
                boolean ok = true;
                for (String s : SCRIPTS) {
                    if (!runFile(c, Path.of(BASE, s))) { System.out.println("[ABORT] " + s); ok = false; break; }
                }
                if (ok) summary(c);
                c.close();
                System.exit(ok ? 0 : 1);
            }
        }
        String bak = args.length > 0 ? args[0] : "D:\\YINJIA-main\\HSDZ_MES_backup_2026_08_28_230001_6527824.bak";
        String url = "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;loginTimeout=5"
                   + ";integratedSecurity=true;authenticationScheme=NTLM;domain=DESKTOP-JHUNFT6";

        Connection c = null;
        SQLException last = null;
        for (int i = 0; i < 30 && c == null; i++) {          // 单用户模式启动重试
            try { c = DriverManager.getConnection(url, "Administrator", "Yin#Admin#2026xQ"); }
            catch (SQLException e) { last = e; Thread.sleep(2000); }
        }
        if (c == null) { System.out.println("[FATAL] 无法以 mesadmin 连接: " + last.getMessage()); System.exit(1); }
        System.out.println("[admin] connected (sysadmin via single-user mode)");

        boolean exists;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "SELECT COUNT(*) FROM sys.databases WHERE name='HSDZ_MES'")) {
            rs.next(); exists = rs.getInt(1) > 0;
        }
        if (exists) System.out.println("[restore] HSDZ_MES 已存在,跳过还原");
        else restoreDb(c, bak);

        exec(c, "IF SUSER_ID('yinjia') IS NULL CREATE LOGIN yinjia WITH PASSWORD='Yinjia@2026', CHECK_POLICY=OFF");
        exec(c, "USE HSDZ_MES; IF USER_ID('yinjia') IS NULL CREATE USER yinjia FOR LOGIN yinjia; "
              + "ALTER ROLE db_datareader ADD MEMBER yinjia; ALTER ROLE db_datawriter ADD MEMBER yinjia; "
              + "ALTER ROLE db_ddladmin ADD MEMBER yinjia");
        System.out.println("[admin] yinjia 登录/用户/角色就绪");

        boolean ok = true;
        for (String s : SCRIPTS) {
            if (!runFile(c, Path.of(BASE, s))) { System.out.println("[ABORT] " + s); ok = false; break; }
        }
        if (ok) { summary(c); System.out.println("\n=== 数据库初始化完成(服务即将恢复正常模式)==="); }
        c.close();
        System.exit(ok ? 0 : 1);
    }

    static void restoreDb(Connection c, String bak) throws SQLException {
        String dataDir, logDir, dataName = null, logName = null;
        try (Statement st = c.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)), CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400))")) {
                rs.next(); dataDir = rs.getString(1); logDir = rs.getString(2);
            }
            try (ResultSet rs = st.executeQuery("RESTORE FILELISTONLY FROM DISK='" + bak + "'")) {
                while (rs.next()) {
                    String t = rs.getString("Type");
                    if ("D".equals(t) && dataName == null) dataName = rs.getString("LogicalName");
                    if ("L".equals(t) && logName == null) logName = rs.getString("LogicalName");
                }
            }
        }
        System.out.println("[restore] logical: " + dataName + " / " + logName + " -> " + dataDir);
        String sql = "RESTORE DATABASE HSDZ_MES FROM DISK='" + bak + "' WITH REPLACE, STATS=10, "
            + "MOVE '" + dataName + "' TO '" + dataDir + "HSDZ_MES.mdf'"
            + (logName != null ? ", MOVE '" + logName + "' TO '" + logDir + "HSDZ_MES_log.ldf'" : "");
        exec(c, sql);
        System.out.println("[restore] 完成");
    }

    static void exec(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement()) { st.execute(sql); }
    }

    static boolean runFile(Connection c, Path file) {
        System.out.println("== " + file.getFileName() + " ==");
        String raw;
        try { raw = Files.readString(file, StandardCharsets.UTF_8); }
        catch (Exception e) { System.err.println("  [读失败] " + e.getMessage()); return false; }
        if (raw.startsWith("\uFEFF")) raw = raw.substring(1);
        try (Statement st = c.createStatement()) {
            for (String batch : splitGo(raw)) {
                String b = batch.trim();
                if (b.isEmpty()) continue;
                st.execute(b);
            }
        } catch (SQLException e) {
            System.err.println("  [SQL失败] " + e.getMessage());
            return false;
        }
        System.out.println("  [OK]");
        return true;
    }

    static List<String> splitGo(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n", -1)) {
            if (line.trim().matches("(?i)GO(\\s+\\d+)?")) { out.add(cur.toString()); cur.setLength(0); }
            else cur.append(line).append('\n');
        }
        out.add(cur.toString());
        return out;
    }

    static void summary(Connection c) throws SQLException {
        String[] qs = {
            "SELECT COUNT(*) FROM yj_panel",
            "SELECT COUNT(*) FROM yj_field",
            "SELECT COUNT(*) FROM yj_translation",
            "SELECT COUNT(*) FROM yj_locale WHERE enabled=1",
            "SELECT COUNT(*) FROM sys.views WHERE name LIKE 'v[_]%'",
            "SELECT COUNT(*) FROM dm_kh",
            "SELECT COUNT(*) FROM bs_partner",
            "SELECT COUNT(*) FROM yj_user",
        };
        try (Statement st = c.createStatement()) {
            for (String q : qs) {
                try (ResultSet rs = st.executeQuery(q)) {
                    rs.next();
                    System.out.println("  " + q + " => " + rs.getString(1));
                } catch (SQLException e) { System.out.println("  " + q + " => 跳过(" + e.getMessage().split("\n")[0] + ")"); }
            }
        }
    }
}
