import java.sql.*;
import java.util.*;

/**
 * 只读探针:比对「目标库 T」与「快照库 S」的表清单,并给出缺表的行数/列数/中文说明。
 * 用法:java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_SnapshotDiff.java <目标库> <快照库> [<快照库2>]
 */
public class _SnapshotDiff {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        String target = a[0], snap = a[1], snap2 = a.length > 2 ? a[2] : null;
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=master;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, USER, PASS)) {
            Set<String> tSet = tables(c, target), sSet = tables(c, snap);
            System.out.println("目标库 " + target + " 表数 = " + tSet.size() + " ;快照库 " + snap + " 表数 = " + sSet.size());
            List<String> onlySnap = new ArrayList<>(sSet); onlySnap.removeAll(tSet); Collections.sort(onlySnap);
            List<String> onlyTarget = new ArrayList<>(tSet); onlyTarget.removeAll(sSet); Collections.sort(onlyTarget);
            System.out.println("\n===== 快照有、目标库没有的表(" + onlySnap.size() + " 张)=====");
            System.out.printf("%-42s %8s %6s  %s%n", "表名", "快照行数", "列数", "中文说明(MS_Description)");
            long totalRows = 0;
            for (String t : onlySnap) {
                long n = count(c, snap, t);
                totalRows += n;
                System.out.printf("%-42s %8d %6d  %s%n", t, n, colCount(c, snap, t), desc(c, snap, t));
            }
            System.out.println("合计快照行数 = " + totalRows);
            System.out.println("\n===== 目标库有、快照没有的表(" + onlyTarget.size() + " 张,说明目标库更新)=====");
            for (String t : onlyTarget) System.out.println("  " + t);

            if (snap2 != null) {
                Set<String> s2 = tables(c, snap2);
                System.out.println("\n===== 两个快照库是否同构 =====");
                System.out.println(snap + " 表数=" + sSet.size() + " ;" + snap2 + " 表数=" + s2.size());
                List<String> d1 = new ArrayList<>(sSet); d1.removeAll(s2);
                List<String> d2 = new ArrayList<>(s2); d2.removeAll(sSet);
                System.out.println("仅在 " + snap + " 有: " + d1);
                System.out.println("仅在 " + snap2 + " 有: " + d2);
                int diff = 0;
                for (String t : sSet) if (s2.contains(t)) {
                    long x = count(c, snap, t), y = count(c, snap2, t);
                    if (x != y) { if (diff < 25) System.out.println("  行数不同: " + t + " " + x + " vs " + y); diff++; }
                }
                System.out.println("行数不同的表数 = " + diff);
            }
        }
    }

    static Set<String> tables(Connection c, String db) throws SQLException {
        Set<String> s = new TreeSet<>();
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT name FROM [" + db + "].sys.tables WHERE is_ms_shipped=0")) {
            while (rs.next()) s.add(rs.getString(1));
        }
        return s;
    }

    static long count(Connection c, String db, String t) {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM [" + db + "].dbo." + q(t))) {
            return rs.next() ? rs.getLong(1) : -1;
        } catch (SQLException e) { return -1; }
    }

    static int colCount(Connection c, String db, String t) {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM [" + db + "].sys.columns WHERE object_id=OBJECT_ID('[" + db + "].dbo." + t.replace("]", "]]") + "')")) {
            return rs.next() ? rs.getInt(1) : -1;
        } catch (SQLException e) { return -1; }
    }

    static String desc(Connection c, String db, String t) {
        try (Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT CAST(ep.value AS nvarchar(300)) FROM [" + db + "].sys.extended_properties ep "
                     + "JOIN [" + db + "].sys.tables tb ON tb.object_id=ep.major_id "
                     + "WHERE ep.name='MS_Description' AND ep.minor_id=0 AND tb.name='" + t.replace("'", "''") + "'")) {
            return rs.next() ? rs.getString(1) : "(无中文说明)";
        } catch (SQLException e) { return "(读取失败)"; }
    }

    static String q(String t) { return "[" + t.replace("]", "]]") + "]"; }
}
