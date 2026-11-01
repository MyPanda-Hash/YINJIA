import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/**
 * 一次性探针：导出「待修正的已结案工单行」修改前原值(用于回滚与取证)。
 * 用法：java -cp lib\mssql-jdbc.jar archive\_wo-batch-date-20261021\_DumpTarget.java <dbName> <outFile>
 * 连接口径与 tools/SqlRunner.java 一致(yinjia/环境变量 YINJIA_SQL_PASS)。
 */
public class _DumpTarget {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        Path out = Path.of(args.length > 1 ? args[1] : "_target_before.tsv");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String sql = "SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.[批次号],N'') AS old_batch,"
                + " CONVERT(varchar(19), p.asp_time1, 120) AS old_asp_time1, CONVERT(varchar(19), p.pl_date, 120) AS pl_date,"
                + " CONVERT(varchar(8), DATEADD(day,3,CAST(p.pl_date AS date)), 112) AS new_batch"
                + " FROM dbo.plang p"
                + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y'"
                + "   AND ISNULL(p.[完工状态],N'') = N'生产完工'"
                + "   AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                + "   AND ((ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')"
                + "   AND p.pl_date IS NOT NULL"
                + "   AND ISNULL(p.[批次号],N'') = N'20261014'"
                + "   AND (ISNULL(p.[批次号],N'') <> CONVERT(varchar(8), DATEADD(day,3,CAST(p.pl_date AS date)), 112)"
                + "        OR CAST(ISNULL(p.asp_time1,'19000101') AS date) <> CAST(p.pl_date AS date))"
                + " ORDER BY p.id";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql);
             BufferedWriter w = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
            w.write("id\tpl_no\tpl_xc\told_batch\told_asp_time1\tpl_date\tnew_batch\n");
            int n = 0;
            while (rs.next()) {
                w.write(rs.getInt(1) + "\t" + rs.getString(2) + "\t" + rs.getInt(3) + "\t" + rs.getString(4)
                        + "\t" + rs.getString(5) + "\t" + rs.getString(6) + "\t" + rs.getString(7) + "\n");
                n++;
            }
            System.out.println("[dumped] " + db + " rows=" + n + " -> " + out.toAbsolutePath());
        }
    }
}
