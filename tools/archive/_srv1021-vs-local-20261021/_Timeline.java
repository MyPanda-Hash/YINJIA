import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;

/** 时间线佐证:库 create_date、owner、今日新建表、以及两库表创建时间分布。 */
public class _Timeline {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;trustServerCertificate=true";

    public static void main(String[] a) throws Exception {
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        try (Connection c = DriverManager.getConnection(String.format(BASE), "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {

            out.println("=== 库信息 ===");
            q(st, out, "SELECT name, CONVERT(varchar(23), create_date, 121) AS create_date, SUSER_SNAME(owner_sid) AS owner, "
                     + "state_desc, recovery_model_desc, compatibility_level, collation_name "
                     + "FROM sys.databases WHERE name IN ('HSDZ_MES','HSDZ_MES_SRV1021')");

            out.println("\n=== 今日(2026-10-21)新建的表 ===");
            for (String db : new String[]{"HSDZ_MES_SRV1021", "HSDZ_MES"}) {
                out.println(" -- " + db);
                q(st, out, "SELECT name, CONVERT(varchar(23), create_date, 121) AS create_date, "
                         + "CONVERT(varchar(23), modify_date, 121) AS modify_date FROM [" + db + "].sys.tables "
                         + "WHERE is_ms_shipped=0 AND create_date >= '2026-10-21' ORDER BY create_date");
            }

            out.println("\n=== 表创建时间分布(前后各 3 个) ===");
            for (String db : new String[]{"HSDZ_MES_SRV1021", "HSDZ_MES"}) {
                out.println(" -- " + db + " 最早:");
                q(st, out, "SELECT TOP 3 name, CONVERT(varchar(23), create_date, 121) AS create_date "
                         + "FROM [" + db + "].sys.tables WHERE is_ms_shipped=0 ORDER BY create_date");
                out.println(" -- " + db + " 最新:");
                q(st, out, "SELECT TOP 6 name, CONVERT(varchar(23), create_date, 121) AS create_date "
                         + "FROM [" + db + "].sys.tables WHERE is_ms_shipped=0 ORDER BY create_date DESC");
            }

            out.println("\n=== 备份表(_bak_pc0000_*)是否两侧都有 ===");
            q(st, out, "SELECT s.name AS srv, l.name AS loc FROM HSDZ_MES_SRV1021.sys.tables s "
                     + "FULL JOIN HSDZ_MES.sys.tables l ON l.name = s.name "
                     + "WHERE s.name LIKE '_bak[_]%' OR l.name LIKE '_bak[_]%'");
            out.println("RESULT: DONE");
        }
    }

    static void q(Statement st, PrintStream out, String sql) {
        try (ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = 0;
            while (rs.next() && n++ < 20) {
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    if (v != null && v.length() > 60) v = v.substring(0, 60) + "…";
                    sb.append(i > 1 ? " | " : "").append(v);
                }
                out.println(sb);
            }
            if (n == 0) out.println("   (0 行)");
        } catch (SQLException e) { out.println("   [ERR] " + e.getMessage()); }
    }
}
