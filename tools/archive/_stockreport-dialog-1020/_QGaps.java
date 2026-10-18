/**
 * _QGaps.java — 库存台账/收发存汇总「查询」口径取证:样本行(含尾部空格)与日期直方图
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QGaps.java [HSDZ_MES]
 */
import java.sql.*;

public class _QGaps {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String sql = "SELECT TOP 5 id, [仓库编码], [存货编码], [单据日期], [单据类型] FROM v_stock_ledger ORDER BY id";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                System.out.println("--- v_stock_ledger 头 5 行(方括号包裹看尾空格) ---");
                while (rs.next()) {
                    System.out.println("id=" + rs.getString(1) + " 仓=[" + rs.getString(2) + "] 存货=[" + rs.getString(3)
                            + "] 日期=[" + rs.getString(4) + "] 类型=[" + rs.getString(5) + "]");
                }
            }
            String sql2 = "SELECT TOP 5 [仓库编码], [存货编码], [期次] FROM v_stock_summary ORDER BY [仓库编码], [存货编码], [期次]";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql2)) {
                System.out.println("--- v_stock_summary 头 5 行 ---");
                while (rs.next()) {
                    System.out.println("仓=[" + rs.getString(1) + "] 存货=[" + rs.getString(2) + "] 期次=[" + rs.getString(3) + "]");
                }
            }
            String sql3 = "SELECT YEAR([单据日期]) y, MONTH([单据日期]) m, COUNT(*) n FROM v_stock_ledger GROUP BY YEAR([单据日期]), MONTH([单据日期]) ORDER BY y, m";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql3)) {
                System.out.println("--- 台账按月行数 ---");
                StringBuilder sb = new StringBuilder();
                while (rs.next()) sb.append(rs.getInt(1)).append("-").append(String.format("%02d", rs.getInt(2))).append(":").append(rs.getInt(3)).append("  ");
                System.out.println(sb);
            }
            String sql4 = "SELECT TOP 5 [仓库名称] FROM bs_wh ORDER BY [仓库编码]";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql4)) {
                System.out.println("--- bs_wh 头 5 个仓库名(看尾空格) ---");
                StringBuilder sb = new StringBuilder();
                while (rs.next()) sb.append("[").append(rs.getString(1)).append("]  ");
                System.out.println(sb);
            }
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM bs_wh WHERE [仓库名称] <> RTRIM([仓库名称])")) {
                rs.next();
                System.out.println("bs_wh 仓库名带尾空格的条数 = " + rs.getInt(1));
            } catch (Exception e) {
                System.out.println("(bs_wh 列名探测失败: " + e.getMessage() + ")");
            }
        }
    }
}
