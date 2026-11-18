import java.sql.*;

/**
 * 2026-11-18 一次性数据订正(4 轮 bug 的残留):
 * 用户在「装箱2(新厂)」线 11-23 填 100 手 → 旧实现只把 plang/当前工序(成型) 推到 11-23,
 * 而看板显示的 装箱 那道台账没动。本脚本把它改成正确结果:
 *   · 装箱 台账 计划完工 11-17 → 11-23(用户填的那天)
 *   · 成型 台账 / plang / plang_pc 的计划完工 11-23 → 11-13(恢复原选择,当前工序不该被推后)
 * 全部带**值守卫**,不匹配就不动;打印影响行数。
 */
public class FixRow2184 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            try {
                int n1 = exec(c, "UPDATE dbo.wo_process_line SET 计划完工日期='2026-11-13', asp_user2='admin', asp_time2=GETDATE()"
                        + " WHERE 工单行id=2184 AND 工序=N'成型' AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " AND CONVERT(varchar(10), 计划开工日期,120)='2026-11-11'"
                        + " AND CONVERT(varchar(10), 计划完工日期,120)='2026-11-23'");
                int n2 = exec(c, "UPDATE dbo.wo_process_line SET 计划完工日期='2026-11-23', asp_user2='admin', asp_time2=GETDATE()"
                        + " WHERE 工单行id=2184 AND 工序=N'装箱' AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " AND CONVERT(varchar(10), 计划开工日期,120)='2026-11-13'"
                        + " AND CONVERT(varchar(10), 计划完工日期,120)='2026-11-17'");
                int n3 = exec(c, "UPDATE dbo.plang SET cp_date='2026-11-13', asp_user2='admin', asp_time2=GETDATE()"
                        + " WHERE id=2184 AND CONVERT(varchar(10), st_date,120)='2026-11-11'"
                        + " AND CONVERT(varchar(10), cp_date,120)='2026-11-23'");
                int n4 = exec(c, "UPDATE dbo.plang_pc SET cp_date='2026-11-13', asp_user2='admin', asp_time2=GETDATE()"
                        + " WHERE id=4010 AND CONVERT(varchar(10), st_date,120)='2026-11-11'"
                        + " AND CONVERT(varchar(10), cp_date,120)='2026-11-23'");
                c.commit();
                System.out.printf("订正完成: 成型台账=%d 装箱台账=%d plang=%d plang_pc=%d%n", n1, n2, n3, n4);
            } catch (Exception e) {
                c.rollback();
                throw e;
            }
        }
        // 复核
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery(
                 "SELECT 工序, CONVERT(varchar(10),计划开工日期,120) st, CONVERT(varchar(10),计划完工日期,120) cp"
                 + " FROM dbo.wo_process_line WHERE 工单行id=2184 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY ISNULL(工序序,999)")) {
            while (r.next()) System.out.printf("复核 台账 %s %s~%s%n", r.getString(1), r.getString(2), r.getString(3));
        }
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery("SELECT CONVERT(varchar(10),st_date,120) st, CONVERT(varchar(10),cp_date,120) cp FROM dbo.plang WHERE id=2184")) {
            while (r.next()) System.out.printf("复核 plang %s~%s%n", r.getString("st"), r.getString("cp"));
        }
    }

    static int exec(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement()) { return s.executeUpdate(sql); }
    }
}
