import java.sql.*;

/** 探针:从 v_stock_pick 里挑几行有货的物料,给 ego 实测用(与手机扫码页同源)。 */
public class _P3 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT TOP 12 存货编码, 存货名称, 仓库, 仓库编码, 批号, 现存量 FROM v_stock_pick "
                 + "WHERE 现存量 > 0 ORDER BY 现存量 DESC")) {
            while (rs.next()) {
                System.out.printf("  %s | %s | [%s]%s | 批号=%s | 现存=%s%n", rs.getString(1), rs.getString(2),
                    rs.getString(4), rs.getString(3), rs.getString(5), rs.getBigDecimal(6));
            }
        } catch (SQLException e) {
            System.out.println("ERR " + e.getMessage());
        }
    }
}
