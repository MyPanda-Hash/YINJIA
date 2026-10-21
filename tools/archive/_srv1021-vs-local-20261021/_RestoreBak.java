import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/**
 * 本次取证(2026-10-21)辅助工具:读取服务器备份头/文件清单,并把备份还原到临时库。
 *
 * 用法:
 *   java _RestoreBak.java <bak绝对路径> <目标库名>
 *
 * 只做两件事:
 *   1) RESTORE HEADERONLY / FILELISTONLY —— 备份元信息(服务器名、备份时间、逻辑名)
 *   2) RESTORE DATABASE <目标库> ... WITH MOVE, REPLACE —— 落到本机默认数据目录
 * 绝不触碰 HSDZ_MES(目标库名带硬闸门,禁止 HSDZ_MES / HSDZ_MES_TEST)。
 */
public class _RestoreBak {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master"
            + ";encrypt=false;trustServerCertificate=true;loginTimeout=30;queryTimeout=1800";
    static PrintStream out;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String bak = a[0];
        String target = a.length > 1 ? a[1] : "HSDZ_MES_SRV1021";

        if (target.equalsIgnoreCase("HSDZ_MES") || target.equalsIgnoreCase("HSDZ_MES_TEST")) {
            out.println("[FATAL] 目标库名若是正式/测试账套,拒绝执行:" + target);
            System.exit(2);
        }

        try (Connection c = DriverManager.getConnection(URL, "sa", "Yinjia@2026")) {
            out.println("== connected as sa, server=" + q1(c, "SELECT @@SERVERNAME")
                    + " version=" + q1(c, "SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50))"));

            out.println("\n---- 1. 备份头 (RESTORE HEADERONLY) ----");
            dump(c, "RESTORE HEADERONLY FROM DISK = N'" + bak + "'", new String[]{
                    "BackupName", "BackupDescription", "BackupType", "ServerName", "DatabaseName",
                    "DatabaseVersion", "BackupStartDate", "BackupFinishDate", "BackupSize",
                    "CompatibilityLevel", "RecoveryModel", "Collation", "UserName", "SoftwareVersion"});

            out.println("\n---- 2. 备份内文件 (RESTORE FILELISTONLY) ----");
            String dataDir = q1(c, "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))");
            String logDir = q1(c, "SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400))");
            out.println("本机数据目录: " + dataDir);
            out.println("本机日志目录: " + logDir);

            StringBuilder moves = new StringBuilder();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("RESTORE FILELISTONLY FROM DISK = N'" + bak + "'")) {
                while (rs.next()) {
                    String logical = rs.getString("LogicalName");
                    String phys = rs.getString("PhysicalName");
                    String type = rs.getString("Type");
                    String base = new java.io.File(phys).getName().replace("HSDZ_MES", target);
                    String dest = ("L".equals(type) ? logDir : dataDir) + base;
                    out.println("   " + type + "  " + logical + "  <- " + phys + "   => " + dest);
                    if (moves.length() > 0) moves.append(", ");
                    moves.append("MOVE N'").append(logical).append("' TO N'").append(dest).append("'");
                }
            }

            out.println("\n---- 3. 还原到临时库 " + target + " ----");
            exec(c, "IF DB_ID(N'" + target + "') IS NOT NULL BEGIN "
                  + "ALTER DATABASE [" + target + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; "
                  + "DROP DATABASE [" + target + "]; END");
            exec(c, "RESTORE DATABASE [" + target + "] FROM DISK = N'" + bak + "' WITH RECOVERY, REPLACE, "
                  + moves);
            out.println("还原完成: " + target);

            // 让 yinjia 能读(sa 已可读,这里保持一致,便于后续只读比对脚本使用 yinjia)
            try {
                exec(c, "USE [" + target + "]; IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name='yinjia') "
                      + "CREATE USER [yinjia] FOR LOGIN [yinjia];");
                exec(c, "USE [" + target + "]; ALTER ROLE db_datareader ADD MEMBER [yinjia];");
            } catch (SQLException e) {
                out.println("[warn] 授权 yinjia 失败(不影响 sa 比对): " + e.getMessage());
            }

            out.println("\n---- 4. 还原后自检 ----");
            out.println("tables=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].sys.tables")
                    + " views=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].sys.views")
                    + " columns=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].sys.columns"));
            out.println("panels=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].dbo.yj_panel")
                    + " fields=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].dbo.yj_field")
                    + " schema_log=" + q1(c, "SELECT COUNT(*) FROM [" + target + "].dbo.yj_schema_log"));
            out.println("RESULT: RESTORE-OK");
        }
    }

    static String q1(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getString(1) : "(null)";
        } catch (SQLException e) { return "(ERR:" + e.getMessage() + ")"; }
    }

    static void dump(Connection c, String sql, String[] cols) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            while (rs.next()) {
                for (String col : cols) {
                    try {
                        String v = rs.getString(col);
                        if (v != null) out.println("   " + col + " = " + v.trim());
                    } catch (SQLException ignore) { }
                }
            }
        } catch (SQLException e) { out.println("   [ERR] " + e.getMessage()); }
    }

    static void exec(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement()) { st.setQueryTimeout(1800); st.execute(sql); }
    }
}
