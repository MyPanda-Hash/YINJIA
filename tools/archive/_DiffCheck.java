import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** Compare column sets of shared tables (local vs remote) and row counts of key tables. */
public class _DiffCheck {
    static final String LOCAL_URL = "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
    static final String LOCAL_USER = "yinjia";
    static final String LOCAL_PASS = "Yinjia@2026";
    static final String REMOTE_URL = "jdbc:sqlserver://36.140.66.163:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=15";
    static final String REMOTE_USER = "sa";
    static final String REMOTE_PASS = "MES0109@@mes0109%%";

    public static void main(String[] args) throws Exception {
        try (Connection lc = DriverManager.getConnection(LOCAL_URL, LOCAL_USER, LOCAL_PASS);
             Connection rc = DriverManager.getConnection(REMOTE_URL, REMOTE_USER, REMOTE_PASS)) {
            Set<String> localTables = names(lc, "SELECT name FROM sys.tables");
            Set<String> remoteTables = names(rc, "SELECT name FROM sys.tables");
            List<String> shared = new ArrayList<>(localTables);
            shared.retainAll(remoteTables);

            StringBuilder report = new StringBuilder();
            int diffCols = 0;
            for (String t : shared) {
                Set<String> lcCols = cols(lc, t);
                Set<String> rcCols = cols(rc, t);
                if (!lcCols.equals(rcCols)) {
                    Set<String> onlyLocal = new TreeSet<>(lcCols);
                    onlyLocal.removeAll(rcCols);
                    Set<String> onlyRemote = new TreeSet<>(rcCols);
                    onlyRemote.removeAll(lcCols);
                    report.append(t).append(" local-only=").append(onlyLocal).append(" remote-only=").append(onlyRemote).append("\n");
                    diffCols++;
                }
            }
            Files.writeString(Path.of("C:/INCER/YINJIA-MES/tools/_diff-report.txt"), report.toString(), StandardCharsets.UTF_8);
            System.out.println("shared tables=" + shared.size() + " with column diffs=" + diffCols);

            // row counts of a few business tables
            for (String t : List.of("bd_so_order", "bl_so_order", "bd_manu_order", "bl_manu_order", "bs_inv", "bs_partner", "bs_dept", "bs_emp", "pd_zzphistory")) {
                try {
                    long l = count(lc, t);
                    long r = count(rc, t);
                    String mark = l == r ? "OK " : "DIFF";
                    System.out.println("  " + mark + " " + t + " local=" + l + " remote=" + r);
                } catch (Exception e) {
                    System.out.println("  ERR " + t + " " + e.getMessage());
                }
            }
        }
    }

    static Set<String> names(Connection c, String sql) throws Exception {
        Set<String> out = new TreeSet<>();
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    static Set<String> cols(Connection c, String t) throws Exception {
        Set<String> out = new TreeSet<>();
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('" + t + "')")) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    static long count(Connection c, String t) throws Exception {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery("SELECT COUNT(*) FROM [" + t + "]")) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
