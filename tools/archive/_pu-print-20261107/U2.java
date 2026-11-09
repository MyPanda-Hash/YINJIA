import java.sql.*;

/** 只读探针:bs_uom.小数位数 / 精度处理 的分布 + 采购订单用过哪些单位(定超送精度规则)。 */
public class U2 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- bs_uom 精度字段 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT [计量单位名称],[计量单位编码],[单位类型],[小数位数],[精度处理] "
                     + "FROM bs_uom WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY [计量单位名称]")) {
                while (rs.next()) {
                    System.out.println("  [" + rs.getString(1) + "] code=" + rs.getString(2)
                        + " type=" + rs.getString(3) + " 小数位数=" + rs.getObject(4) + " 精度处理=" + rs.getObject(5));
                }
            }
            System.out.println("--- 采购订单行用过的单位 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT [单位] AS u, COUNT(*) AS n FROM bl_pu_order "
                     + "WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [单位] ORDER BY n DESC")) {
                while (rs.next()) System.out.println("  [" + rs.getString("u") + "] x" + rs.getInt("n"));
            }
            System.out.println("--- 采购订单里带小数的行(单位/数量) ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 20 [单位] AS u, [数量] AS q FROM bl_pu_order "
                     + "WHERE ISNULL(asp_cancel,'N')<>'Y' AND [数量] <> ROUND([数量],0) ORDER BY id DESC")) {
                while (rs.next()) System.out.println("  [" + rs.getString("u") + "] = " + rs.getString("q"));
            }
        }
    }
}
