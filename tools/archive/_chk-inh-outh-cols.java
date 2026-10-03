import java.sql.*;

/** 只读:核对重建后 inh/outh 的列类型(供 DashboardStatsService 改列名时确认日期列类型)。 */
public class InhOuthCols {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10",
                "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement s = c.createStatement()) {
            System.out.println("connected: " + c.getCatalog());
            for (String t : new String[]{"inh", "outh"}) {
                ResultSet r = s.executeQuery("SELECT name, TYPE_NAME(user_type_id) AS ty, max_length, is_nullable"
                        + " FROM sys.columns WHERE object_id=OBJECT_ID('dbo." + t + "')"
                        + " AND (name IN (N'单据编号',N'单据日期',N'单据类型',N'数量',N'金额',N'单据金额',N'src',N'rid') OR name LIKE N'备用%')"
                        + " ORDER BY column_id");
                System.out.println("== " + t + " ==");
                while (r.next())
                    System.out.println("  " + r.getString(1) + " | " + r.getString(2) + "(" + r.getInt(3) + ") | null=" + r.getString(4));
                r = s.executeQuery("SELECT COUNT(*) FROM dbo." + t);
                r.next();
                System.out.println("  rows=" + r.getInt(1));
            }
            // 首页统计 trend7 的日期比较是否可跑(datetime vs date)
            ResultSet r = s.executeQuery("SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE()))");
            r.next();
            System.out.println("trend7 inh 命中行数 = " + r.getInt(1));
        }
    }
}
