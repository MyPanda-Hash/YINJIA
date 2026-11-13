import java.sql.*;

/** 只读:测试账套 kucun 有库存的 (wzdm, ckdm, lot_no) 组合 + 最近一次金蝶库存同步时间。 */
public class ProbeStock2 {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            System.out.println("== TOP 15 有库存(wzdm/ckdm/lot_no/yl) ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 15 wzdm, ckdm, lot_no, yl FROM kucun "
                         + "WHERE ISNULL(yl,0) > 0 ORDER BY yl DESC")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getDouble(4));
            }
            System.out.println("== 最近库存同步日志 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 3 * FROM erp_stock_sync_log ORDER BY id DESC")) {
                ResultSetMetaData m = r.getMetaData();
                while (r.next()) {
                    StringBuilder sb = new StringBuilder("  ");
                    for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append('=').append(r.getString(i)).append(" ; ");
                    System.out.println(sb);
                }
            } catch (SQLException e) { System.out.println("  [无 erp_stock_sync_log] " + e.getMessage()); }
            System.out.println("== 成品/正品仓有库存 TOP 8 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT TOP 8 wzdm, ckdm, lot_no, yl FROM kucun "
                         + "WHERE ISNULL(yl,0) > 0 AND (ckdm LIKE N'%CP%' OR ckdm LIKE N'%ZP%') ORDER BY yl DESC")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getDouble(4));
            }
        }
    }
}
