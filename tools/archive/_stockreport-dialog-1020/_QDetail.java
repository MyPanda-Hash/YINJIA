/**
 * _QDetail.java — 台账视图里「有流水明细」的 (仓库,存货) 组合:给 _v-gate.mjs 选样本用
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QDetail.java [HSDZ_MES]
 */
import java.sql.*;

public class _QDetail {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String sql = "SELECT TOP 8 [仓库编码], [仓库], [存货编码], [存货], COUNT(*) AS n, "
                    + "MIN([单据日期]) AS d0, MAX([单据日期]) AS d1 "
                    + "FROM v_stock_ledger WHERE [单据类型] NOT IN (N'期初结存', N'期末结存') "
                    + "GROUP BY [仓库编码], [仓库], [存货编码], [存货] ORDER BY n DESC";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                System.out.println("仓编码\t仓名\t存货编码\t存货\t流水行数\t最早\t最晚");
                while (rs.next()) {
                    System.out.println(String.join("\t", rs.getString(1), rs.getString(2), rs.getString(3),
                            rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7)));
                }
            }
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) AS n, COUNT(DISTINCT [仓库编码]) AS w FROM v_stock_ledger")) {
                rs.next();
                System.out.println("台账总行数=" + rs.getInt(1) + " 不同仓库数=" + rs.getInt(2));
            }
        }
    }
}
