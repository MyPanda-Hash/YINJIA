import java.sql.*;
public class Probe8 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                "SELECT p.id, p.pl_no, ISNULL(p.pl_xc,0) 行号, p.dm, ISNULL(p.pl_sl,0) 排产, ISNULL(p.scx,N'') 线,"
                + " CONVERT(varchar(10), p.st_date,120) st, CONVERT(varchar(10), p.cp_date,120) cp"
                + " FROM dbo.plang p WHERE p.dm=N'B-46-13' AND ISNULL(p.asp_cancel,'N')<>'Y'")) {
                while (r.next()) System.out.printf("plang id=%s %s 行%s 排产=%s 线=%s %s~%s%n",
                    r.getString(1), r.getString(2), r.getString(3), r.getString(5), r.getString(6), r.getString(7), r.getString(8));
            }
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                "SELECT w.工单行id, w.工序, ISNULL(w.状态,N'') 状态, COALESCE(NULLIF(w.实际生产线,N''),w.计划生产线) 线,"
                + " CONVERT(varchar(10), w.计划开工日期,120) st, CONVERT(varchar(10), w.计划完工日期,120) cp, ISNULL(w.计划数量,0) qty"
                + " FROM dbo.wo_process_line w JOIN dbo.plang p ON p.id=w.工单行id"
                + " WHERE p.dm=N'B-46-13' AND ISNULL(w.asp_cancel,'N')<>'Y' ORDER BY w.工单行id, ISNULL(w.工序序,999)")) {
                while (r.next()) System.out.printf("台账 行id=%s %s 状态=%s 线=%s %s~%s qty=%s%n",
                    r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6), r.getString(7));
            }
        }
    }
}
