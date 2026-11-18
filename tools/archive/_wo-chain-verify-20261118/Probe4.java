import java.sql.*;

/** 2026-11-18 收尾核对:正式库没被本次验证写脏(日排产格数/工单 3213 日期/列设置未动)。 */
public class Probe4 {
    public static void main(String[] a) throws Exception {
        String base = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(base + ";databaseName=HSDZ_MES", "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement()) {
                ResultSet r = s.executeQuery("SELECT COUNT(*) FROM dbo.wo_day_plan");
                r.next(); System.out.println("正式库 wo_day_plan 行数 = " + r.getLong(1));
                r = s.executeQuery("SELECT CONVERT(varchar(10), st_date,120) st, CONVERT(varchar(10), cp_date,120) cp,"
                        + " CONVERT(varchar(19), asp_time2,120) t2 FROM dbo.plang WHERE id=3213");
                while (r.next()) System.out.printf("正式库 plang 3213 st=%s cp=%s asp_time2=%s%n", r.getString("st"), r.getString("cp"), r.getString("t2"));
                r = s.executeQuery("SELECT panel_code, update_by, CONVERT(varchar(19), update_time,120) t FROM dbo.report_column_settings ORDER BY panel_code");
                while (r.next()) System.out.printf("列设置 %s by=%s at=%s%n", r.getString("panel_code"), r.getString("update_by"), r.getString("t"));
            }
        }
    }
}
