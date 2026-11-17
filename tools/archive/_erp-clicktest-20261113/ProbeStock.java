import java.sql.*;

/**
 * 只读:测试账套里**有库存**的 (物料, 仓库, 批号) 组合(用于造"能过金蝶库存校验"的出库类单据)。
 * 金蝶库存以同步为准(AGENTS:库存数量真源=金蝶),kucun 就是它落地的表。
 */
public class ProbeStock {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;loginTimeout=10", "yinjia", "Yinjia@2026")) {
            System.out.println("== " + db + " kucun 有库存 TOP 20 (物料/仓库/批号/数量) ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 20 物料编码, 物料名称, 仓库, 批号, yl FROM kucun "
                         + "WHERE ISNULL(yl,0) > 0 AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY yl DESC")) {
                while (r.next()) {
                    System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3)
                            + " | " + r.getString(4) + " | yl=" + r.getBigDecimal(5));
                }
            } catch (SQLException e) { System.out.println("  [kucun 读取失败] " + e.getMessage()); }
            System.out.println("== 成品仓/正品仓 有库存 TOP 10 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 10 物料编码, 仓库, 批号, yl FROM kucun "
                         + "WHERE ISNULL(yl,0) > 0 AND (仓库 LIKE N'%成品%' OR 仓库 LIKE N'%正品%') ORDER BY yl DESC")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getBigDecimal(4));
            } catch (SQLException e) { System.out.println("  [读取失败] " + e.getMessage()); }
        }
    }
}
