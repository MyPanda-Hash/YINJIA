import java.sql.*;

/** 只读探针:找一张明细行数≥3 的采购订单(界面实测"勾选/填数量"用)。 */
public class Q3 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        String sql = "SELECT TOP 15 单据编号, COUNT(*) AS c FROM bl_pu_order "
            + "WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据编号 LIKE 'YJ-20261012-%' "
            + "GROUP BY 单据编号 HAVING COUNT(*) >= 3 ORDER BY 单据编号";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) System.out.println(rs.getString(1) + " lines=" + rs.getInt(2));
        }
    }
}
