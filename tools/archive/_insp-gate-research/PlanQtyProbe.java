import java.sql.*;

/** 只读:成型计划量的两个候选来源对不上时,看现场数据长什么样(工单行排产数量/路线换算率/台账计划数量)。 */
public class PlanQtyProbe {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("== " + db + " ==");
            show(c, "在用路线的工序与换算率",
                    "SELECT 工艺路线编码, 工序序 = ISNULL(加工顺序,999), 工序名称, ISNULL(换算率,1) AS 换算率"
                  + " FROM dbo.bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工艺路线编码, ISNULL(加工顺序,999)");
            show(c, "有成型报工的工单的 plang 行",
                    "SELECT p.id, p.pl_no, p.pl_xc, ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.xq_sl,0) AS xq_sl,"
                  + " ISNULL(p.[工艺路线],N'') AS route, ISNULL(p.[批次号],N'') AS batch,"
                  + " ISNULL(p.[当前工序],N'') AS cur, ISNULL(p.[完工状态],N'') AS done, ISNULL(p.ja,'N') AS ja"
                  + " FROM dbo.plang p WHERE p.pl_no IN (SELECT gldh FROM dbo.scjl WHERE gxdm=N'成型')"
                  + " ORDER BY p.pl_no, p.pl_xc");
            show(c, "该工单行各工序已审报工量(按 工单号+工单行号 锚定)",
                    "SELECT s.gxdm AS 工序, COUNT(*) AS 行数, SUM(ISNULL(s.sl,0)) AS 已审量"
                  + " FROM dbo.scjl s WHERE s.gldh IN (SELECT gldh FROM dbo.scjl WHERE gxdm=N'成型')"
                  + "   AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.asp_cancel,'N')<>'Y' GROUP BY s.gxdm");
            show(c, "工单行的路线与产线覆盖(关注「无路线 / 无产线」的行)",
                    "SELECT"
                  + "  COUNT(*) AS 未作废行,"
                  + "  SUM(CASE WHEN ISNULL([工艺路线],N'')=N'' THEN 1 ELSE 0 END) AS 无工艺路线,"
                  + "  SUM(CASE WHEN ISNULL(scx,N'')=N'' THEN 1 ELSE 0 END) AS 无生产线,"
                  + "  SUM(CASE WHEN ISNULL([工艺路线],N'')=N'' AND ISNULL(scx,N'')=N'' THEN 1 ELSE 0 END) AS 两者都无"
                  + " FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'");
            show(c, "无工艺路线的行明细(样例)",
                    "SELECT TOP 10 id, pl_no, pl_xc, ISNULL([工艺路线],N'') AS route, ISNULL(scx,N'') AS scx,"
                  + " ISNULL([当前工序],N'') AS cur, ISNULL([完工状态],N'') AS done, ISNULL(ja,'N') AS ja"
                  + " FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([工艺路线],N'')=N'' ORDER BY id");
            show(c, "报工工序分布 vs 路线是否可校验(无路线工单的报工)",
                    "SELECT ISNULL(s.gxdm,N'') AS 工序, COUNT(*) AS 行数 FROM dbo.scjl s"
                  + " JOIN dbo.plang p ON p.pl_no = s.gldh AND ISNULL(p.asp_cancel,'N')<>'Y'"
                  + " WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(p.[工艺路线],N'')=N'' GROUP BY s.gxdm");
            show(c, "工序任务表 wo_progress(口径 3「工序任务已完工」的取数面)",
                    "SELECT ISNULL(工序,N'') AS 工序, ISNULL(状态,N'') AS 状态, COUNT(*) AS 行数,"
                  + " SUM(CASE WHEN ISNULL(工单行id,0)>0 THEN 1 ELSE 0 END) AS 已锚行id,"
                  + " ISNULL(SUM(完成数量),0) AS 完成数量 FROM dbo.wo_progress"
                  + " WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工序, 状态");
        }
    }

    static void show(Connection c, String title, String sql) {
        System.out.println("--- " + title + " ---");
        try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println(h);
            while (r.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(i > 1 ? " | " : "").append(r.getString(i));
                System.out.println(b);
            }
        } catch (SQLException e) {
            System.out.println("[SQL 失败] " + e.getMessage());
        }
    }
}
