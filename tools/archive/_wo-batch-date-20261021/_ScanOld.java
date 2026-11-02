import java.sql.*;
import java.util.*;

/** 一次性探针：改号后扫描全库，找「旧号(GD-2026-10-xxxx)」是否还有残留引用。 */
public class _ScanOld {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            List<String> olds = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT DISTINCT N'GD-2026-10-' + RIGHT(p.pl_no,4) FROM dbo.plang p"
                     + " WHERE p.pl_no LIKE N'GD-2026-09-%'"
                     + " AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'"
                     + " AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                     + " AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')"
                     + " AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01'")) {
                while (rs.next()) olds.add(rs.getString(1));
            }
            System.out.println("[db=" + db + "] old numbers=" + olds.size());
            try (Statement st = c.createStatement()) {
                st.execute("IF OBJECT_ID('tempdb..#o') IS NOT NULL DROP TABLE #o");
                st.execute("CREATE TABLE #o(old_no nvarchar(56) PRIMARY KEY)");
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO #o(old_no) VALUES(?)")) {
                for (String o : olds) { ps.setString(1, o); ps.addBatch(); }
                ps.executeBatch();
            }
            List<String[]> cols = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT t.name, c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id"
                     + " JOIN sys.types ty ON ty.user_type_id=c.user_type_id"
                     + " WHERE t.is_ms_shipped=0 AND t.name NOT LIKE N'[_]bak[_]%'"
                     + " AND ty.name IN ('nvarchar','varchar','nchar','char')"
                     + " ORDER BY t.name, c.column_id")) {
                while (rs.next()) cols.add(new String[]{rs.getString(1), rs.getString(2)});
            }
            int hitCols = 0;
            for (String[] tc : cols) {
                String q = "SELECT COUNT(*) FROM dbo." + qn(tc[0]) + " x JOIN #o m ON x." + qn(tc[1]) + "=m.old_no";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(q)) {
                    rs.next();
                    int n = rs.getInt(1);
                    if (n > 0) { System.out.println("  " + tc[0] + "." + tc[1] + " = " + n); hitCols++; }
                } catch (SQLException ignore) { }
            }
            System.out.println("[done] columns with old-number hits=" + hitCols);
        }
    }
    static String qn(String s) { return "[" + s.replace("]", "]]") + "]"; }
}
