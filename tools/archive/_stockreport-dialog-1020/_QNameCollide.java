/**
 * _QNameCollide.java — 名称精确等值的"同名多码"规模(解释 _QVerify 里 120 vs 73 的差额)
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QNameCollide.java [HSDZ_MES]
 */
import java.sql.*;

public class _QNameCollide {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String wh = "成品B仓", it = "PP复合阻垢炭棒/滤芯";
            System.out.println("== " + db + " 名称精确等值的命中来源(仓库名=" + wh + " 存货名=" + it + ") ==");
            String sql = "SELECT [仓库编码], [仓库], [存货编码], [存货], COUNT(*) AS n FROM v_stock_ledger "
                    + "WHERE RTRIM([仓库])=? AND RTRIM([存货])=? GROUP BY [仓库编码], [仓库], [存货编码], [存货] "
                    + "ORDER BY n DESC";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, wh);
                ps.setString(2, it);
                try (ResultSet rs = ps.executeQuery()) {
                    int total = 0, groups = 0;
                    System.out.println("  仓编码\t仓名\t存货编码\t存货\t行数");
                    while (rs.next()) {
                        total += rs.getInt(5);
                        groups++;
                        System.out.println("  " + rs.getString(1) + "\t" + rs.getString(2) + "\t" + rs.getString(3)
                                + "\t" + rs.getString(4) + "\t" + rs.getInt(5));
                    }
                    System.out.println("  ── 合计 " + total + " 行 / " + groups + " 个(仓,存货编码)组合");
                }
            }
        }
    }
}
