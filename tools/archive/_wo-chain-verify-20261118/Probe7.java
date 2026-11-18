import java.sql.*;

/** 2026-11-18 第二轮保存后取证:测试库 工单行id=2184 的台账日期 + plang。 */
public class Probe7 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES_TEST";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT 工序, ISNULL(状态,N'') AS 状态, ISNULL(计划生产线,N'') AS 线,"
                    + " CONVERT(varchar(10), 计划开工日期,120) AS st, CONVERT(varchar(10), 计划完工日期,120) AS cp,"
                    + " CONVERT(varchar(19), asp_time2,120) AS t2 FROM dbo.wo_process_line"
                    + " WHERE 工单行id=2184 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(工序序,999), id")) {
                while (r.next()) System.out.printf("台账 %s 状态=%s 线=%s %s~%s at=%s%n",
                        r.getString("工序"), r.getString("状态"), r.getString("线"), r.getString("st"), r.getString("cp"), r.getString("t2"));
            }
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT id, CONVERT(varchar(10), st_date,120) st, CONVERT(varchar(10), cp_date,120) cp,"
                    + " ISNULL(scx,N'') scx, ISNULL(pl_sl,0) qty FROM dbo.plang WHERE id=2184")) {
                while (r.next()) System.out.printf("plang %s st=%s cp=%s 线=%s 排=%s%n",
                        r.getString("id"), r.getString("st"), r.getString("cp"), r.getString("scx"), r.getString("qty"));
            }
        }
    }
}
