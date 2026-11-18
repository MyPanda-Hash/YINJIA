import java.sql.*;

/** 2026-11-18 第四轮取证:GD-2026-11-0012 行3(组装/装箱行)的人工日计划与各处日期,定位「填了 11-23 表格但计划完工日还是 11-17」。 */
public class Probe10 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES_TEST";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("== plang ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT id, pl_no, ISNULL(pl_xc,0) 行号, ISNULL(scx,N'') 线, ISNULL([当前工序],N'') 当前,"
                    + " CONVERT(varchar(10), st_date,120) st, CONVERT(varchar(10), cp_date,120) cp, ISNULL(pl_sl,0) 排产"
                    + " FROM dbo.plang WHERE id IN (2184, 3214, 2202) ORDER BY id")) {
                while (r.next()) System.out.printf("  id=%s %s 行%s 线=%s 当前=%s %s~%s 排=%s%n",
                        r.getString("id"), r.getString("pl_no"), r.getString("行号"), r.getString("线"),
                        r.getString("当前"), r.getString("st"), r.getString("cp"), r.getString("排产"));
            }
            System.out.println("== wo_process_line ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT 工单行id, 工序, ISNULL(状态,N'') 状态, COALESCE(NULLIF(实际生产线,N''),计划生产线) 线,"
                    + " CONVERT(varchar(10), 计划开工日期,120) st, CONVERT(varchar(10), 计划完工日期,120) cp, ISNULL(计划数量,0) qty"
                    + " FROM dbo.wo_process_line WHERE 工单行id IN (2184, 3214, 2202) AND ISNULL(asp_cancel,'N')<>'Y'"
                    + " ORDER BY 工单行id, ISNULL(工序序,999)")) {
                while (r.next()) System.out.printf("  行id=%s %s 状态=%s 线=%s %s~%s qty=%s%n",
                        r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6), r.getString(7));
            }
            System.out.println("== wo_day_plan(未作废) ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT 工单行id, 工序, CONVERT(varchar(10), 计划日期,120) d, 计划数量, asp_user1,"
                    + " CONVERT(varchar(19), asp_time1,120) t FROM dbo.wo_day_plan WHERE asp_cancel='N'"
                    + " AND 工单行id IN (2184, 3214, 2202) ORDER BY 工单行id, 工序, 计划日期")) {
                while (r.next()) System.out.printf("  行id=%s %s %s qty=%s by=%s at=%s%n",
                        r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6));
            }
        }
    }
}
