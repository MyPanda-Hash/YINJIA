/*
 * Probe2.java — 2026-10-29 调拨收口第二段取证(只读):找「当前工序 = 切炭/装箱/组装」的实际已排产行,
 * 供接口验收(切炭→只能切炭线;装箱→组装线;成型+切炭混选→无交集)。
 *
 * 跑法(tools 目录): java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\Probe2.java
 */
import java.sql.*;

public class Probe2 {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static final String OP = "ISNULL(NULLIF((SELECT TOP 1 w.工序 FROM dbo.wo_process_line w"
            + " WHERE w.工单号=p.pl_no AND ISNULL(w.asp_cancel,'N')<>'Y'"
            + "   AND (w.工单行id=p.id OR w.工单行id IS NULL) AND ISNULL(w.状态,N'')=N'已落实'"
            + " ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC), N''), ISNULL(p.[当前工序],N''))";

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("== DB " + DB + " ==\n");
            System.out.println("① 已排产行按当前工序分布");
            q(c, "SELECT t.当前工序, COUNT(*) AS 行数 FROM (SELECT " + OP + " AS 当前工序 FROM dbo.plang p"
                    + " WHERE ISNULL(p.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y') t"
                    + " GROUP BY t.当前工序 ORDER BY 行数 DESC");
            System.out.println("\n② 当前工序=切炭 的已排产行(取前 5)");
            sample(c, "N'切炭'");
            System.out.println("\n③ 当前工序=装箱/组装 的已排产行(取前 5)");
            q(c, "SELECT TOP 5 p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 行号, p.scx AS 当前线,"
                    + " (SELECT TOP 1 l.生产车间 FROM dbo.bs_prod_line l WHERE l.生产线=p.scx) AS 线车间, "
                    + OP + " AS 当前工序 FROM dbo.plang p"
                    + " WHERE ISNULL(p.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y' AND " + OP + " IN (N'装箱',N'组装')"
                    + " ORDER BY p.id DESC");
        }
    }

    static void sample(Connection c, String opLiteral) throws SQLException {
        q(c, "SELECT TOP 5 p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 行号, p.scx AS 当前线,"
                + " (SELECT TOP 1 l.生产车间 FROM dbo.bs_prod_line l WHERE l.生产线=p.scx) AS 线车间, "
                + OP + " AS 当前工序 FROM dbo.plang p"
                + " WHERE ISNULL(p.scx,N'')<>N'' AND ISNULL(p.asp_cancel,'N')<>'Y' AND " + OP + " = " + opLiteral
                + " ORDER BY p.id DESC");
    }

    static void q(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= n; i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            System.out.println("  " + "-".repeat(Math.max(head.length(), 24)));
            while (r.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= n; i++) row.append(i > 1 ? " | " : "").append(r.getString(i) == null ? "" : r.getString(i));
                System.out.println("  " + row);
            }
        }
    }
}
