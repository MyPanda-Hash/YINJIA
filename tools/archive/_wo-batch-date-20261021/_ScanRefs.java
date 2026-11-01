import java.sql.*;
import java.util.*;

/**
 * 一次性探针：扫描全库所有字符列，找出「引用某批工单号」的列与行数。
 * 用法：java -cp lib\mssql-jdbc.jar archive\_wo-batch-date-20261021\_ScanRefs.java <dbName>
 * old numbers 取自「已结案 + 单据日期在 2026-09」的 plang.pl_no(GD-2026-10-xxxx)。
 */
public class _ScanRefs {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            List<String> olds = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT DISTINCT p.pl_no FROM dbo.plang p"
                     + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'"
                     + " AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                     + " AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')"
                     + " AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01'")) {
                while (rs.next()) olds.add(rs.getString(1));
            }
            System.out.println("[db=" + db + "] old numbers=" + olds.size());
            try (Statement st = c.createStatement()) {
                st.execute("IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m");
                st.execute("CREATE TABLE #m(old_no nvarchar(56) PRIMARY KEY)");
            }
            try (PreparedStatement ps = c.prepareStatement("INSERT INTO #m(old_no) VALUES(?)")) {
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
                String q = "SELECT COUNT(*) FROM dbo." + qn(tc[0]) + " x JOIN #m m ON x." + qn(tc[1]) + "=m.old_no";
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(q)) {
                    rs.next();
                    int n = rs.getInt(1);
                    if (n > 0) {
                        System.out.println("  " + tc[0] + "." + tc[1] + " = " + n);
                        hitCols++;
                    }
                } catch (SQLException ignore) { }
            }
            System.out.println("[done] columns with hits=" + hitCols);
        }
    }

    static String qn(String s) { return "[" + s.replace("]", "]]") + "]"; }
}
