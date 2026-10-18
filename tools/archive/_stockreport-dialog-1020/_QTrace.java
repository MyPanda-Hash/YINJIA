/**
 * _QTrace.java — 台账查询「明细为 0」定位:同一组合在视图 / 直接 WHERE / 带编码条件 下的行数
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QTrace.java
 */
import java.sql.*;

public class _QTrace {
    static Connection c;

    static int n(String sql, Object... args) throws Exception {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    public static void main(String[] a) throws Exception {
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;user=yinjia;password=" + pw
                + ";encrypt=false;trustServerCertificate=true");
        String wh = "CP-02", it = "A-48-19";
        System.out.println("① 视图总行数              = " + n("SELECT COUNT(*) FROM v_stock_ledger"));
        System.out.println("② 该组合全部行            = " + n(
                "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM([仓库编码])=? AND RTRIM([存货编码])=?", wh, it));
        System.out.println("③ 该组合非合成行          = " + n(
                "SELECT COUNT(*) FROM v_stock_ledger WHERE RTRIM([仓库编码])=? AND RTRIM([存货编码])=? AND [单据类型] NOT IN (N'期初结存',N'期末结存')", wh, it));
        System.out.println("④ 该组合 单据类型分布:");
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT TOP 15 [单据类型], COUNT(*) FROM v_stock_ledger WHERE RTRIM([仓库编码])=? AND RTRIM([存货编码])=? GROUP BY [单据类型] ORDER BY 2 DESC")) {
            ps.setString(1, wh); ps.setString(2, it);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) System.out.println("      [" + rs.getString(1) + "] = " + rs.getInt(2));
            }
        }
        System.out.println("⑤ asp_cancel 分布(视图上):");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "SELECT ISNULL(CAST([asp_cancel] AS nvarchar(10)),'NULL') v, COUNT(*) FROM v_stock_ledger GROUP BY [asp_cancel]")) {
            while (rs.next()) System.out.println("      asp_cancel=" + rs.getString(1) + " → " + rs.getInt(2));
        } catch (Exception e) {
            System.out.println("      (视图无 asp_cancel 列: " + e.getMessage() + ")");
        }
        System.out.println("⑥ 该组合 日期范围:");
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT MIN([单据日期]), MAX([单据日期]), MIN(id), MAX(id) FROM v_stock_ledger WHERE RTRIM([仓库编码])=? AND RTRIM([存货编码])<>?")) {
            ps.setString(1, wh); ps.setString(2, it);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                System.out.println("      仓内其它存货 日期 " + rs.getString(1) + " ~ " + rs.getString(2));
            }
        }
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT MIN([单据日期]), MAX([单据日期]) FROM v_stock_ledger WHERE RTRIM([仓库编码])=? AND RTRIM([存货编码])=?")) {
            ps.setString(1, wh); ps.setString(2, it);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                System.out.println("      该组合 日期 " + rs.getString(1) + " ~ " + rs.getString(2));
            }
        }
        c.close();
    }
}
