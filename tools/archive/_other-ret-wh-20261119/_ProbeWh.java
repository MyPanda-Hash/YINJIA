import java.sql.*;

/** 探针:仓库档案 bs_wh 有哪些仓、停用怎么表示(其他退料「退到仓库」下拉要排掉停用仓)。 */
public class _ProbeWh {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("== " + db + " bs_wh 列 ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_wh' ORDER BY ORDINAL_POSITION")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " : " + rs.getString(2));
            }
            System.out.println("== bs_wh 行 ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT 仓库编码, 仓库名称, 停用 FROM bs_wh ORDER BY 仓库编码")) {
                while (rs.next()) {
                    System.out.printf("  [%s] %s | 停用=%s%n", rs.getString(1), rs.getString(2), rs.getString(3));
                }
            }
        } catch (SQLException e) {
            System.out.println("SQLSTATE=" + e.getSQLState() + " MSG=" + e.getMessage());
        }
    }
}
