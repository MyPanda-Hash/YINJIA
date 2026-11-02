import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/** 探针:确认容器内 /var/opt/mssql/data 与宿主机 D:\sql\data 是同一挂载,并列出容器内 bak。 */
public class _ProbePaths {
    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {
            out.println("servername=" + one(st, "SELECT @@SERVERNAME")
                    + "  machinename=" + one(st, "SELECT CAST(SERVERPROPERTY('MachineName') AS nvarchar(100))")
                    + "  platform=" + one(st, "SELECT CAST(SERVERPROPERTY('Edition') AS nvarchar(200))"));
            out.println("data=" + one(st, "SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))"));
            out.println("\n---- xp_fileexist on candidate paths ----");
            for (String p : new String[]{
                    "/var/opt/mssql/data/HSDZ_MES_deploy_20261020c.bak",
                    "/var/opt/mssql/data/HSDZ_MES-manual-20261021-092322.bak",
                    "D:\\workspace\\yinjia\\deploy\\HSDZ_MES-manual-20261021-092322.bak"}) {
                out.println("  " + p + " -> " + fileExists(st, p));
            }
            out.println("\n---- xp_dirtree /var/opt/mssql/data (bak only) ----");
            try (ResultSet rs = st.executeQuery(
                    "EXEC master.dbo.xp_dirtree '/var/opt/mssql/data', 1, 1")) {
                while (rs.next()) {
                    String n = rs.getString(1);
                    if (n != null && n.toLowerCase().endsWith(".bak")) out.println("   " + n + "  size=" + rs.getString(2));
                }
            } catch (SQLException e) { out.println("   [ERR] " + e.getMessage()); }
        }
    }

    static String one(Statement st, String sql) {
        try (ResultSet rs = st.executeQuery(sql)) { return rs.next() ? rs.getString(1) : "(null)"; }
        catch (SQLException e) { return "(ERR:" + e.getMessage() + ")"; }
    }

    static String fileExists(Statement st, String p) {
        try {
            try (ResultSet rs = st.executeQuery("DECLARE @e int; EXEC master.dbo.xp_fileexist N'" + p
                    + "', @e OUTPUT; SELECT @e")) {
                return rs.next() ? rs.getString(1) : "?";
            }
        } catch (SQLException e) { return "(ERR:" + e.getMessage() + ")"; }
    }
}
