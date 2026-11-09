import java.sql.*;

/** 只读:看这单打印记录是否被作废。 */
public class U13 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             PreparedStatement ps = c.prepareStatement(
                 "SELECT [单据编号], [打印版式], ISNULL(asp_cancel,'N') AS c, CONVERT(varchar(19),[asp_time2],120) AS t2"
                 + " FROM bd_pu_print WHERE [采购订单号]=? ORDER BY id")) {
            ps.setString(1, "YJ-20261105-01");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) System.out.println(rs.getString(1) + " " + rs.getString(2)
                    + " cancel=" + rs.getString(3) + " t2=" + rs.getString(4));
            }
        }
    }
}
