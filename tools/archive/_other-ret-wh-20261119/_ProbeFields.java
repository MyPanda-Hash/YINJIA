import java.sql.*;

/**
 * 探针:其他退料(生产退料单 MATERIAL_RET)的字段元数据 + WH 仓库档案面板口径。
 * 用途:确认「退到仓库」要写的标签名(仓库 / 仓库编码)、参照源,以及 WH 面板的列名。
 */
public class _ProbeFields {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("== " + db + " MATERIAL_RET fields ==");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT seq, label, col_name, place, ISNULL(data_type,'') dt, ISNULL(ref_panel,'') rp, "
                    + "ISNULL(ref_field,'') rf, visible, hidden, ISNULL(required,'') req "
                    + "FROM yj_field WHERE panel_code='MATERIAL_RET' ORDER BY seq, id")) {
                while (rs.next()) {
                    System.out.printf("%3d | %-12s | %-12s | %-10s | %-10s | %-8s | %-10s | v=%d h=%d req=%s%n",
                        rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                        rs.getString(6), rs.getString(7), rs.getInt(8), rs.getInt(9), rs.getString(10));
                }
            }
            System.out.println("== WH panel ==");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE panel_code='WH'")) {
                while (rs.next()) {
                    System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3)
                        + " | " + rs.getString(4) + " | " + rs.getString(5));
                }
            }
            System.out.println("== WH fields ==");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT seq, label, col_name, place FROM yj_field WHERE panel_code='WH' ORDER BY seq, id")) {
                while (rs.next()) {
                    System.out.printf("%3d | %-12s | %-12s | %s%n",
                        rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4));
                }
            }
            System.out.println("== 最近 5 张扫码其他退料单 ==");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT TOP 5 单据编号, 单据日期, 单据状态 FROM bd_material_ret "
                    + "WHERE 备注 LIKE N'扫码其他退料%' ORDER BY id DESC")) {
                while (rs.next()) {
                    System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3));
                }
            }
        } catch (SQLException e) {
            System.out.println("SQLSTATE=" + e.getSQLState() + " MSG=" + e.getMessage());
        }
    }
}
