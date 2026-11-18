import java.sql.*;

/** 探针:各仓实际结存(kucun.ckdm)+ 生产退料单历史用仓,判断「停用」列能不能当下拉过滤条件。 */
public class _ProbeWhUse2 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("== " + db + " kucun 按 ckdm ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT k.ckdm, MAX(w.仓库名称) 名称, COUNT(*) 行数, SUM(k.yl) 结存, "
                    + "MAX(CAST(ISNULL(w.停用,0) AS int)) 停用 "
                    + "FROM kucun k LEFT JOIN bs_wh w ON w.仓库编码 = k.ckdm "
                    + "GROUP BY k.ckdm ORDER BY SUM(k.yl) DESC")) {
                while (rs.next()) {
                    System.out.printf("  [%s] %s | 行=%d | 结存=%s | 停用=%s%n",
                        rs.getString(1), rs.getString(2), rs.getInt(3), rs.getBigDecimal(4), rs.getString(5));
                }
            }
            System.out.println("== 生产退料单历史用仓 ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT TOP 10 仓库编码, 仓库, COUNT(*) 行数 FROM bl_material_ret "
                    + "GROUP BY 仓库编码, 仓库 ORDER BY COUNT(*) DESC")) {
                while (rs.next()) {
                    System.out.printf("  [%s] %s | 行=%d%n", rs.getString(1), rs.getString(2), rs.getInt(3));
                }
            }
            System.out.println("== 扫码其他退料单(备注前缀) ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT TOP 10 h.单据编号, h.单据日期, h.单据状态, l.材料编码, l.仓库编码, l.仓库, l.数量 "
                    + "FROM bd_material_ret h JOIN bl_material_ret l ON l.单据编号=h.单据编号 "
                    + "WHERE h.备注 LIKE N'扫码其他退料%' ORDER BY h.id DESC")) {
                while (rs.next()) {
                    System.out.printf("  %s %s %s | %s → [%s] %s × %s%n", rs.getString(1), rs.getString(2),
                        rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getBigDecimal(7));
                }
            }
        } catch (SQLException e) {
            System.out.println("SQLSTATE=" + e.getSQLState() + " MSG=" + e.getMessage());
        }
    }
}
