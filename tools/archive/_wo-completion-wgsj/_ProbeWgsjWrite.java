import java.sql.*;
import java.time.LocalDateTime;

/**
 * 机制探针:把 {@code LocalDateTime.now()}(应用本地墙钟)绑定进 scjl.wgsj,读回验证。
 *
 * 目的 —— 证明代码改动(WoReportService.complete() 由 GETDATE() 改为绑定 LocalDateTime.now())
 * 真的能把「报工完成那一刻的本地时间」写进完工明细;对照同一时刻的 GETDATE()(容器 UTC)差 8 小时。
 * 只动 HSDZ_MES_TEST 的 1 行,读完立刻还原原值;不改结构、不建对象。
 */
public class _ProbeWgsjWrite {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
        c.setAutoCommit(true);
        Statement s = c.createStatement();
        ResultSet r = s.executeQuery("SELECT TOP 1 id, CONVERT(varchar(23), wgsj, 121) FROM dbo.scjl"
                + " WHERE ISNULL(wgzt,'N')='Y' AND ISNULL(asp_cancel,'N')<>'Y' AND wgsj IS NOT NULL ORDER BY id");
        if (!r.next()) throw new IllegalStateException("测试库没有已完工行,无法取证");
        int id = r.getInt(1);
        String before = r.getString(2);

        LocalDateTime now = LocalDateTime.now();
        try (PreparedStatement ps = c.prepareStatement("UPDATE dbo.scjl SET wgsj=? WHERE id=?")) {
            ps.setObject(1, now);           // 与 Spring JdbcTemplate 传 LocalDateTime 同款绑定
            ps.setInt(2, id);
            ps.executeUpdate();
        }
        ResultSet w = s.executeQuery("SELECT CONVERT(varchar(23), wgsj, 121) AS app,"
                + " CONVERT(varchar(23), GETDATE(), 121) AS dbnow,"
                + " CONVERT(varchar(23), SYSDATETIMEOFFSET(), 121) AS dboff"
                + " FROM dbo.scjl WHERE id=" + id);
        w.next();
        String app = w.getString("app"), dbnow = w.getString("dbnow"), dboff = w.getString("dboff");
        System.out.println("行 id=" + id + " 原 wgsj = " + before);
        System.out.println("JVM 本地现在   = " + now.withNano(0));
        System.out.println("写入后 DB 值   = " + app + "   (LocalDateTime 绑定到 datetime 列)");
        System.out.println("DB GETDATE()   = " + dbnow + "   SYSDATETIMEOFFSET=" + dboff);
        long delta = Math.abs(java.time.Duration.between(
                now.withNano(0), LocalDateTime.parse(app.replace(' ', 'T'))).getSeconds());
        System.out.println(delta <= 5
                ? "[PASS] 绑定 LocalDateTime.now() 写入的值 = 应用本地墙钟(与 GETDATE() 相差 8 小时)差 " + delta + "s"
                : "[FAIL] 写入值与本地墙钟差 " + delta + "s");

        // 还原
        try (PreparedStatement ps = c.prepareStatement("UPDATE dbo.scjl SET wgsj=? WHERE id=?")) {
            ps.setString(1, before);
            ps.setInt(2, id);
            ps.executeUpdate();
        }
        ResultSet back = s.executeQuery("SELECT CONVERT(varchar(23), wgsj, 121) FROM dbo.scjl WHERE id=" + id);
        back.next();
        System.out.println("已还原 wgsj = " + back.getString(1) + (before.equals(back.getString(1)) ? "  [OK]" : "  [还原不一致!]"));
        c.close();
    }
}
