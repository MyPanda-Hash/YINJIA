import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.sql.*;
import java.util.*;

/**
 * 对象时间线取证(只读):两库逐表取 create_date / modify_date,并列出
 * 「服务器在本地还原之后(<since>)仍被改动」的对象 —— 定位服务器侧最近的真实变更。
 *
 * 用法: java _ObjTimes.java <库A> <库B> [since]   since 例: 2026-10-20T22:35
 */
public class _ObjTimes {
    static final String BASE = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static PrintStream out;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String dbA = a[0], dbB = a[1];
        String since = a.length > 2 ? a[2] : "2026-10-20T22:35";
        Timestamp ts = Timestamp.valueOf(since.replace('T', ' ') + ":00");

        try (Connection c = DriverManager.getConnection(String.format(BASE, "master"), "sa", "Yinjia@2026");
             Statement st = c.createStatement()) {

            out.println("== 库级时间线 ==");
            for (String db : new String[]{dbA, dbB}) {
                try (ResultSet rs = st.executeQuery("SELECT name, create_date, "
                        + "CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(30)) FROM sys.databases WHERE name='" + db + "'")) {
                    if (rs.next()) out.println("   " + db + "  create=" + rs.getString(2));
                }
                try (ResultSet rs = st.executeQuery("SELECT MAX(create_date) FROM [" + db + "].sys.objects")) {
                    if (rs.next()) out.println("        最新对象创建时间=" + rs.getString(1));
                }
            }

            out.println("\n== 服务器(=" + dbA + ")在 " + since + " 之后被改动的对象 ==");
            String sql = "SELECT t.name, t.create_date, t.modify_date FROM [" + dbA + "].sys.tables t "
                    + "WHERE t.is_ms_shipped = 0 AND t.modify_date >= ? ORDER BY t.modify_date";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setTimestamp(1, ts);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) out.println(String.format("   %-42s modify=%s create=%s",
                            rs.getString(1), rs.getString(3), rs.getString(2)));
                }
            }

            out.println("\n== 两库表结构时间戳不一致的表(只列差异) ==");
            Map<String, String[]> ma = tableTimes(c, dbA), mb = tableTimes(c, dbB);
            TreeSet<String> all = new TreeSet<>(ma.keySet()); all.addAll(mb.keySet());
            for (String t : all) {
                String[] x = ma.get(t), y = mb.get(t);
                if (x == null) { out.println(String.format("   %-42s 仅本地存在 create=%s", t, y[1])); continue; }
                if (y == null) { out.println(String.format("   %-42s 仅服务器存在 create=%s", t, x[1])); continue; }
                if (!x[0].equals(y[0]) || !x[1].equals(y[1]) || !x[2].equals(y[2])) {
                    out.println(String.format("   %-40s 服务器 create=%s modify=%s | 本地 create=%s modify=%s",
                            t, x[1], x[2], y[1], y[2]));
                }
            }
            out.println("RESULT: DONE");
        }
    }

    /** table -> [create, modify, columnCount] */
    static Map<String, String[]> tableTimes(Connection c, String db) throws SQLException {
        Map<String, String[]> m = new TreeMap<>();
        String sql = "SELECT t.name, CONVERT(varchar(23), t.create_date, 121), CONVERT(varchar(23), t.modify_date, 121), "
                + "(SELECT COUNT(*) FROM [" + db + "].sys.columns c WHERE c.object_id=t.object_id) "
                + "FROM [" + db + "].sys.tables t WHERE t.is_ms_shipped=0";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) m.put(rs.getString(1), new String[]{rs.getString(2), rs.getString(2) + "~" + rs.getString(3), rs.getString(3)});
        }
        return m;
    }
}
