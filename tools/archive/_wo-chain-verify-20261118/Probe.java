import java.sql.*;

/** 2026-11-18 三处需求的只读取证:候选工单行(实际完工≠计划完工)、测试库可用性、日排产区间。 */
public class Probe {
    static final String BASE = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;lockTimeout=8000";

    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            System.out.println("================ " + db);
            try (Connection c = DriverManager.getConnection(BASE + ";databaseName=" + db, "yinjia", "Yinjia@2026")) {
                counts(c);
                candidates(c, db);
            } catch (Exception e) {
                System.out.println("!! " + db + " 连接/查询失败: " + e.getMessage());
            }
        }
    }

    static void counts(Connection c) throws SQLException {
        String[] sqls = {
            "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'",
            "SELECT COUNT(*) FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'",
            "SELECT COUNT(*) FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y'",
            "SELECT COUNT(*) FROM dbo.wo_day_plan",
        };
        String[] names = {"plang", "wo_process_line", "scjl", "wo_day_plan"};
        for (int i = 0; i < sqls.length; i++) {
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sqls[i])) {
                r.next();
                System.out.println("  " + names[i] + " = " + r.getLong(1));
            } catch (Exception e) {
                System.out.println("  " + names[i] + " ? " + e.getMessage());
            }
        }
    }

    static void candidates(Connection c, String db) throws SQLException {
        String sql = """
            SELECT TOP 12 w.工单号, w.工单行id, w.工序, ISNULL(w.工序序,0) AS 工序序,
                   CONVERT(varchar(10), w.计划开工日期, 120) AS st,
                   CONVERT(varchar(10), w.计划完工日期, 120) AS cp,
                   ISNULL(w.状态,N'') AS 状态,
                   (SELECT CONVERT(varchar(16), MAX(COALESCE(s.wgsj, s.kssj, s.sc_date)), 120)
                      FROM dbo.scjl s
                     WHERE s.gldh = w.工单号 AND ISNULL(s.gxdm, N'') = ISNULL(w.工序, N'')
                       AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'
                       AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = w.工单行id)
                            OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'') =
                                (SELECT ISNULL([批次号],N'') FROM dbo.plang WHERE id = w.工单行id)))
                   ) AS 实际完工
              FROM dbo.wo_process_line w
             WHERE ISNULL(w.asp_cancel,'N')<>'Y' AND w.工单行id IS NOT NULL
               AND EXISTS (SELECT 1 FROM dbo.wo_process_line n
                            WHERE ISNULL(n.asp_cancel,'N')<>'Y' AND n.工单行id = w.工单行id
                              AND ISNULL(n.工序序,999) > ISNULL(w.工序序,999))
             ORDER BY w.id DESC
            """;
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            System.out.println("  -- 有后道的台账行(工单号|行id|工序|序|st|cp|状态|实际完工)");
            while (r.next()) {
                System.out.printf("  %s | %s | %s | %s | %s | %s | %s | %s%n",
                        r.getString("工单号"), r.getString("工单行id"), r.getString("工序"),
                        r.getString("工序序"), r.getString("st"), r.getString("cp"),
                        r.getString("状态"), r.getString("实际完工"));
            }
        }
        String gd = "GD-2026-10-0228";
        try (PreparedStatement p = c.prepareStatement(
                "SELECT id, pl_no, ISNULL(pl_xc,0) AS 行号, ISNULL([工艺路线],N'') AS 路线,"
                + " CONVERT(varchar(10), st_date, 120) AS st, CONVERT(varchar(10), cp_date, 120) AS cp,"
                + " ISNULL(scx,N'') AS 线, ISNULL(pl_sl,0) AS 排产 FROM dbo.plang"
                + " WHERE pl_no=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id")) {
            p.setString(1, gd);
            try (ResultSet r = p.executeQuery()) {
                System.out.println("  -- " + gd + " 工单行");
                while (r.next()) {
                    System.out.printf("  id=%s 行号=%s 路线=%s st=%s cp=%s 线=%s 排产=%s%n",
                            r.getString("id"), r.getString("行号"), r.getString("路线"),
                            r.getString("st"), r.getString("cp"), r.getString("线"), r.getString("排产"));
                }
            }
        }
    }
}
