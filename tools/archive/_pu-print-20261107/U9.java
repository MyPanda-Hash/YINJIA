import java.sql.*;

/** 只读:核对补拉后 (a) 既有单据行 id 未变 (b) 新单的行数量/单位/单价齐全。 */
public class U9 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- 既有单 YJ-20261012-11 的行 id(应与补拉前一致:4751..4757) ---");
            try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, 行号, 物料编码, 单位, 数量 FROM bl_pu_order WHERE 单据编号=? ORDER BY id")) {
                ps.setString(1, "YJ-20261012-11");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println("  id=" + rs.getInt(1) + " 行" + rs.getString(2)
                        + " " + rs.getString(3) + " 单位=" + rs.getString(4) + " 数量=" + rs.getBigDecimal(5));
                }
            }
            System.out.println("--- 新补拉单 YJ-20261105-05 的行 ---");
            try (PreparedStatement ps = c.prepareStatement(
                "SELECT id, 行号, 物料编码, 物料名称, 单位, 数量, 单价, 金额 FROM bl_pu_order WHERE 单据编号=? ORDER BY id")) {
                ps.setString(1, "YJ-20261105-05");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println("  id=" + rs.getInt(1) + " 行" + rs.getString(2)
                        + " " + rs.getString(3) + " " + rs.getString(4) + " 单位=" + rs.getString(5)
                        + " 数量=" + rs.getBigDecimal(6) + " 单价=" + rs.getBigDecimal(7) + " 金额=" + rs.getBigDecimal(8));
                }
            }
            System.out.println("--- 新补拉销售单 LYZ-20261107-01 的行 ---");
            try (PreparedStatement ps = c.prepareStatement(
                "SELECT 行号, 存货编码, 存货名称, 销售单位, 数量, 单价, 金额 FROM bl_so_order WHERE 单据编号=? ORDER BY id")) {
                ps.setString(1, "LYZ-20261107-01");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println("  行" + rs.getString(1) + " " + rs.getString(2) + " "
                        + rs.getString(3) + " 单位=" + rs.getString(4) + " 数量=" + rs.getBigDecimal(5)
                        + " 单价=" + rs.getBigDecimal(6) + " 金额=" + rs.getBigDecimal(7));
                }
            }
        }
    }
}
