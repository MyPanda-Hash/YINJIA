import java.sql.*;

/** 只读探针:单位档案结构 + 采购订单里实际出现过的单位(定"超送精度按单位"的规则用)。 */
public class U1 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- bs_uom columns ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                     + "WHERE TABLE_NAME='bs_uom' ORDER BY ORDINAL_POSITION")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2));
            }
            System.out.println("--- bs_uom rows ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 60 * FROM bs_uom")) {
                ResultSetMetaData m = rs.getMetaData();
                while (rs.next()) {
                    StringBuilder sb = new StringBuilder();
                    for (int i = 1; i <= Math.min(8, m.getColumnCount()); i++) {
                        sb.append(m.getColumnLabel(i)).append('=').append(rs.getString(i)).append("  ");
                    }
                    System.out.println("  " + sb);
                }
            }
            System.out.println("--- 采购订单行用过的单位(去重) ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT [单位] AS u, COUNT(*) AS n FROM bl_pu_order "
                     + "WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [单位] ORDER BY n DESC")) {
                while (rs.next()) System.out.println("  [" + rs.getString("u") + "] x" + rs.getInt("n"));
            }
            System.out.println("--- 小数数量的行(单位/数量样例) ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 15 [单位], [数量] FROM bl_pu_order "
                     + "WHERE ISNULL(asp_cancel,'N')<>'Y' AND [数量] <> ROUND([数量],0) ORDER BY id DESC")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " = " + rs.getString(2));
            }
        }
    }
}
