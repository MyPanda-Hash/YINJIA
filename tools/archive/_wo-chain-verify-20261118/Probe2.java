import java.sql.*;

/** 2026-11-18 第三项(区间外日期格可填)验证前取证:测试库/正式库里「已排产、未完工、有计划区间」的行。 */
public class Probe2 {
    static final String BASE = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;lockTimeout=8000";

    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES_TEST", "HSDZ_MES"}) {
            System.out.println("================ " + db);
            try (Connection c = DriverManager.getConnection(BASE + ";databaseName=" + db, "yinjia", "Yinjia@2026");
                 Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("""
                     SELECT TOP 15 p.id, p.pl_no, ISNULL(p.pl_xc,0) AS 行号, ISNULL(p.scx,N'') AS 线,
                            CONVERT(varchar(10), p.st_date, 120) AS st, CONVERT(varchar(10), p.cp_date, 120) AS cp,
                            ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库, ISNULL(p.[当前工序],N'') AS 当前工序
                       FROM dbo.plang p
                      WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''
                        AND ISNULL(p.pl_sl,0)>0 AND p.cp_date IS NOT NULL
                        AND ISNULL(p.rk_sl,0) < ISNULL(p.pl_sl,0)
                      ORDER BY p.id DESC
                     """)) {
                while (r.next()) {
                    System.out.printf("  id=%s %s 行%s 线=%s st=%s cp=%s 排=%s 入=%s 当前=%s%n",
                            r.getString("id"), r.getString("pl_no"), r.getString("行号"), r.getString("线"),
                            r.getString("st"), r.getString("cp"), r.getString("排产"), r.getString("入库"),
                            r.getString("当前工序"));
                }
            } catch (Exception e) {
                System.out.println("  !! " + e.getMessage());
            }
        }
    }
}
