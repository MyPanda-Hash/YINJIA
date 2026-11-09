import java.sql.*;

/** 只读:采购订单按日期/导入时间排序的前 10 张(核对界面 rail 顺序)。 */
public class U10 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- ORDER BY 单据日期 DESC, 单据编号 DESC ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 10 单据编号, 单据日期, CONVERT(nvarchar(19), asp_time1, 120) AS t "
                     + "FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据日期 DESC, 单据编号 DESC")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " | asp_time1=" + rs.getString(3));
            }
            System.out.println("--- 本次导入(asp_user1='试运行')计数 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM bd_pu_order WHERE asp_user1=N'试运行' AND 单据日期>='2026-10-01'")) {
                rs.next(); System.out.println("  采购=" + rs.getInt(1));
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM bd_so_order WHERE asp_user1=N'试运行' AND 单据日期>='2026-10-01'")) {
                rs.next(); System.out.println("  销售=" + rs.getInt(1));
            }
        }
    }
}
