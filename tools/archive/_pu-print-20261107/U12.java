import java.sql.*;

/** 只读:按版式统计某订单各行的已打印量,核对「已打印只算本版式」。 */
public class U12 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT l.[采购订单行id], h.[打印版式], SUM(l.[打印数量]) AS q, COUNT(*) AS n"
                    + " FROM bl_pu_print l JOIN bd_pu_print h ON h.[单据编号]=l.[单据编号]"
                    + " WHERE h.[采购订单号]=? AND ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'"
                    + " GROUP BY l.[采购订单行id], h.[打印版式] ORDER BY l.[采购订单行id], h.[打印版式]")) {
                ps.setString(1, "YJ-20261105-01");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println("行id=" + rs.getInt(1) + " 版式=" + rs.getString(2)
                        + " 已打印=" + rs.getBigDecimal(3) + " 记录数=" + rs.getInt(4));
                }
            }
        }
    }
}
