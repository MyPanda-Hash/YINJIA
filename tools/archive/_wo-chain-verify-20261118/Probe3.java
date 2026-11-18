import java.sql.*;

/** 2026-11-18 第三项验证后取证:测试库 id=2180 的日期扩展 + 三处同步。 */
public class Probe3 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url + ";databaseName=HSDZ_MES_TEST", "yinjia", "Yinjia@2026")) {
            try (PreparedStatement p = c.prepareStatement(
                    "SELECT id, pl_no, CONVERT(varchar(10), st_date, 120) AS st, CONVERT(varchar(10), cp_date, 120) AS cp,"
                    + " ISNULL([当前工序],N'') AS 当前工序, asp_user2, CONVERT(varchar(19), asp_time2, 120) AS t2"
                    + " FROM dbo.plang WHERE id=2180");
                 ResultSet r = p.executeQuery()) {
                while (r.next()) System.out.printf("plang   id=%s %s st=%s cp=%s 当前=%s by=%s at=%s%n",
                        r.getString("id"), r.getString("pl_no"), r.getString("st"), r.getString("cp"),
                        r.getString("当前工序"), r.getString("asp_user2"), r.getString("t2"));
            }
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT CONVERT(varchar(10), cp_date, 120) AS cp, scx FROM dbo.plang_pc WHERE plang_id=2180 AND ISNULL(asp_cancel,'N')<>'Y'")) {
                while (r.next()) System.out.println("plang_pc cp=" + r.getString("cp") + " scx=" + r.getString("scx"));
            }
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT 工序, 状态, CONVERT(varchar(10), 计划开工日期, 120) AS st,"
                         + " CONVERT(varchar(10), 计划完工日期, 120) AS cp FROM dbo.wo_process_line"
                         + " WHERE 工单行id=2180 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(工序序,999)")) {
                while (r.next()) System.out.printf("ledger  %s %s %s~%s%n", r.getString("工序"), r.getString("状态"), r.getString("st"), r.getString("cp"));
            }
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT 工序, CONVERT(varchar(10), 计划日期, 120) AS d, 计划数量, asp_user1"
                         + " FROM dbo.wo_day_plan WHERE 工单行id=2180 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 计划日期 DESC")) {
                while (r.next()) System.out.printf("dayplan %s %s qty=%s by=%s%n", r.getString("工序"), r.getString("d"), r.getString("计划数量"), r.getString("asp_user1"));
            }
        }
    }
}
