import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 一次性探针：导出 9 月已结案工单号 改号前原值(回滚/取证)。 */
public class _DumpPlNo {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path out = Path.of(args.length > 1 ? args[1] : "_plno_before.tsv");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String sql = "SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0), CONVERT(varchar(19), p.pl_date, 120),"
                + " N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no"
                + " FROM dbo.plang p"
                + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y'"
                + "   AND ISNULL(p.[完工状态],N'') = N'生产完工'"
                + "   AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                + "   AND ((ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')"
                + "   AND CAST(p.pl_date AS date) >= '2026-09-01' AND CAST(p.pl_date AS date) < '2026-10-01'"
                + "   AND p.pl_no LIKE N'GD-2026-10-%'"
                + " ORDER BY p.id";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql);
             BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            w.write("id\tpl_no\tpl_xc\tpl_date\tnew_no\n");
            int n = 0;
            while (rs.next()) {
                w.write(rs.getInt(1) + "\t" + rs.getString(2) + "\t" + rs.getInt(3) + "\t" + rs.getString(4)
                        + "\t" + rs.getString(5) + "\n");
                n++;
            }
            System.out.println("[dumped] " + db + " rows=" + n + " -> " + out.toAbsolutePath());
        }
    }
}
