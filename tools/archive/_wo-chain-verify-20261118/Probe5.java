import java.sql.*;

/**
 * 2026-11-18 第二轮:看清楚 GD-2026-10-0228 行1 的整条台账 + 每道实际开工/完工/报工,
 * 以及「装箱2(新厂)」线上为什么会出现这一行(本线工序口径)。
 */
public class Probe5 {
    static final String URL = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES";

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            System.out.println("== plang 3213 ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT id, pl_no, ISNULL(pl_xc,0) AS 行号, ISNULL([工艺路线],N'') AS 路线,"
                    + " ISNULL(scx,N'') AS 线, ISNULL([当前工序],N'') AS 当前,"
                    + " CONVERT(varchar(10), st_date,120) AS st, CONVERT(varchar(10), cp_date,120) AS cp,"
                    + " ISNULL(pl_sl,0) AS 排产, ISNULL(rk_sl,0) AS 入库 FROM dbo.plang WHERE id=3213")) {
                while (r.next()) {
                    System.out.printf("  %s 行%s 路线=%s 线=%s 当前=%s st=%s cp=%s 排=%s 入=%s%n",
                            r.getString("pl_no"), r.getString("行号"), r.getString("路线"), r.getString("线"),
                            r.getString("当前"), r.getString("st"), r.getString("cp"),
                            r.getString("排产"), r.getString("入库"));
                }
            }
            System.out.println("== 路线 bs_route ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT 工序名称, 加工顺序, 换算率 FROM dbo.bs_route WHERE 工艺路线编码=N'GY-CB-STD'"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(加工顺序,999)")) {
                while (r.next()) System.out.printf("  %s 序=%s 率=%s%n", r.getString(1), r.getString(2), r.getString(3));
            }
            System.out.println("== wo_process_line(工单行id=3213) ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT id, 工序, ISNULL(工序序,0) AS 序, ISNULL(计划生产线,N'') AS 计划线, ISNULL(实际生产线,N'') AS 实际线,"
                    + " ISNULL(状态,N'') AS 状态, ISNULL(计划数量,0) AS 量,"
                    + " CONVERT(varchar(10), 计划开工日期,120) AS st, CONVERT(varchar(10), 计划完工日期,120) AS cp"
                    + " FROM dbo.wo_process_line WHERE 工单行id=3213 AND ISNULL(asp_cancel,'N')<>'Y'"
                    + " ORDER BY ISNULL(工序序,999), id")) {
                while (r.next()) {
                    System.out.printf("  #%s %s 序%s 计划线=%s 实际线=%s 状态=%s 量=%s %s~%s%n",
                            r.getString("id"), r.getString("工序"), r.getString("序"), r.getString("计划线"),
                            r.getString("实际线"), r.getString("状态"), r.getString("量"), r.getString("st"), r.getString("cp"));
                }
            }
            System.out.println("== scjl 报工(本行,已审) ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT ISNULL(s.gxdm,N'') AS 工序, COUNT(*) AS 笔, ISNULL(SUM(s.sl),0) AS 数量,"
                    + " CONVERT(varchar(19), MIN(COALESCE(s.kssj,s.wgsj,s.sc_date)),120) AS 最早,"
                    + " CONVERT(varchar(19), MAX(COALESCE(s.wgsj,s.kssj,s.sc_date)),120) AS 最晚"
                    + " FROM dbo.scjl s WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                    + "   AND s.gldh=N'GD-2026-10-0228'"
                    + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=3213)"
                    + "        OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=(SELECT ISNULL([批次号],N'') FROM dbo.plang WHERE id=3213)))"
                    + " GROUP BY ISNULL(s.gxdm,N'') ORDER BY 工序")) {
                while (r.next()) {
                    System.out.printf("  %s 笔=%s 量=%s 最早=%s 最晚=%s%n", r.getString("工序"), r.getString("笔"),
                            r.getString("数量"), r.getString("最早"), r.getString("最晚"));
                }
            }
            System.out.println("== 装箱2(新厂) 线上为什么有 GD-2026-10-0228(台账 计划线/实际线 = 该线的行) ==");
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
                    "SELECT w.工单行id, w.工序, ISNULL(w.状态,N'') AS 状态,"
                    + " COALESCE(NULLIF(w.实际生产线,N''), ISNULL(w.计划生产线,N'')) AS 线,"
                    + " CONVERT(varchar(10), w.计划开工日期,120) AS st, CONVERT(varchar(10), w.计划完工日期,120) AS cp,"
                    + " ISNULL(w.计划数量,0) AS 量 FROM dbo.wo_process_line w"
                    + " WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.工单号,N'')=N'GD-2026-10-0228'"
                    + " AND COALESCE(NULLIF(w.实际生产线,N''), ISNULL(w.计划生产线,N'')) = N'装箱2(新厂)'"
                    + " ORDER BY ISNULL(w.工序序,999)")) {
                while (r.next()) {
                    System.out.printf("  行id=%s %s 状态=%s 线=%s %s~%s 量=%s%n",
                            r.getString("工单行id"), r.getString("工序"), r.getString("状态"), r.getString("线"),
                            r.getString("st"), r.getString("cp"), r.getString("量"));
                }
            }
        }
    }
}
