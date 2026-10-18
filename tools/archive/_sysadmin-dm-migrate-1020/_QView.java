import java.sql.*;

/** _QView.java — v_stock_balance 是否真有「预警数量」列并可用 */
public class _QView {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            System.out.println("===== " + db + " =====");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) AS n, SUM(CASE WHEN ISNULL([预警数量],0)>0 THEN 1 ELSE 0 END) AS warn FROM v_stock_balance")) {
                rs.next();
                System.out.println("  v_stock_balance 行数=" + rs.getInt(1) + " 其中预警数量>0 的=" + rs.getInt(2));
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 3 [仓库],[存货],[现存量],[预警数量] FROM v_stock_balance WHERE ISNULL([预警数量],0)>0")) {
                while (rs.next()) System.out.println("  样本: " + rs.getString(1) + " / " + rs.getString(2) + " 现有=" + rs.getDouble(3) + " 预警=" + rs.getDouble(4));
            }
        }
    }
}
