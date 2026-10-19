import java.io.*;
import java.sql.*;

/**
 * 把服务器备份还原到本地 Docker SQL Server(覆盖 HSDZ_MES),还原前先自备份。
 * 用法: java _Restore <容器内bak路径> [目标库]
 * 连接: sa(容器 MSSQL_SA_PASSWORD),库=master —— 普通 yinjia 账号无 CREATE DATABASE 权限。
 */
public class _Restore {
    static PrintStream out;
    static Connection c;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String bak = a[0];
        String db = a.length > 1 ? a[1] : "HSDZ_MES";
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=master"
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=15;queryTimeout=600", "sa", "Yinjia@2026");
        out.println("== connected as sa ==");

        out.println("\n---- 备份内文件 ----");
        q("RESTORE FILELISTONLY FROM DISK = N'" + bak + "'", new String[]{"LogicalName", "Type", "PhysicalName"});

        // 当前库物理文件(还原落点)
        String dataPath = null, logPath = null;
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "SELECT physical_name, type_desc FROM sys.master_files WHERE database_id = DB_ID(N'" + db + "')")) {
            while (rs.next()) {
                if ("ROWS".equals(rs.getString(2)) && dataPath == null) dataPath = rs.getString(1);
                if ("LOG".equals(rs.getString(2)) && logPath == null) logPath = rs.getString(1);
            }
        }
        out.println("\n数据文件: " + dataPath + "\n日志文件: " + logPath);

        // 还原前自备份
        String stamp = new java.text.SimpleDateFormat("yyyyMMdd-HHmmss").format(new java.util.Date());
        String safety = dataPath.substring(0, dataPath.lastIndexOf('/') + 1) + db + "-before-import-" + stamp + ".bak";
        out.println("\n---- 自备份 → " + safety + " ----");
        exec("BACKUP DATABASE [" + db + "] TO DISK = N'" + safety + "' WITH INIT, NAME = N'before-import'");
        out.println("自备份完成");

        // 逻辑名 → 物理路径
        StringBuilder moves = new StringBuilder();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("RESTORE FILELISTONLY FROM DISK = N'" + bak + "'")) {
            while (rs.next()) {
                String logical = rs.getString("LogicalName");
                String type = rs.getString("Type");
                String to = "L".equals(type) ? logPath : dataPath;
                if (moves.length() > 0) moves.append(", ");
                moves.append("MOVE N'").append(logical).append("' TO N'").append(to).append("'");
            }
        }
        out.println("\n---- 覆盖还原 " + db + " ----");
        exec("ALTER DATABASE [" + db + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE");
        exec("RESTORE DATABASE [" + db + "] FROM DISK = N'" + bak + "' WITH REPLACE, RECOVERY, " + moves);
        exec("ALTER DATABASE [" + db + "] SET MULTI_USER");
        out.println("还原完成");

        // yinjia 用户映射(db_owner)
        try {
            exec("USE [" + db + "]; ALTER USER [yinjia] WITH LOGIN = [yinjia];");
            out.println("yinjia 用户已重新映射");
        } catch (SQLException e) {
            out.println("yinjia 映射提示: " + e.getMessage());
        }
        try {
            exec("USE [" + db + "]; ALTER ROLE db_owner ADD MEMBER [yinjia];");
            out.println("yinjia → db_owner");
        } catch (SQLException e) {
            out.println("授权提示: " + e.getMessage());
        }

        out.println("\n---- 还原后核对 ----");
        q("USE [" + db + "]; SELECT COUNT(*) AS 表数 FROM sys.tables", null);
        q("USE [" + db + "]; SELECT COUNT(*) AS 未作废工单行,"
                + " SUM(CASE WHEN ISNULL(ja,'N') IN ('T','Y') THEN 1 ELSE 0 END) AS 结案行,"
                + " MAX(CONVERT(varchar(19), asp_time1, 120)) AS 最后建单时间 FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'", null);
        c.close();
    }

    static void exec(String sql) throws SQLException {
        try (Statement st = c.createStatement()) { st.execute(sql); }
    }

    static void q(String sql, String[] cols) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            out.println(h);
            int k = 0;
            while (rs.next() && k < 20) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) b.append(rs.getString(i)).append(i < n ? " | " : "");
                out.println(b);
                k++;
            }
        } catch (SQLException e) {
            out.println("[SQL失败] " + e.getMessage());
        }
    }
}
