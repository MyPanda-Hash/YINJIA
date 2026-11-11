import java.sql.*;

/** 只读:列清单 + PI-2026-11-0038 现场。运行: java -cp lib\mssql-jdbc.jar ..\tools\archive\_erp-0038-20261111\Probe2.java [库名] */
public class Probe2 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10", "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "列清单 bd_purchase_in", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_purchase_in') ORDER BY column_id");
            sec(c, "列清单 bl_purchase_in", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_purchase_in') ORDER BY column_id");
            sec(c, "是否存在单据 0038(各库口径:头部行数)",
                    "SELECT COUNT(*) n FROM bd_purchase_in WHERE 单据编号 LIKE N'PI-2026-11-00%'");
            sec(c, "11 月入库单(编号/日期/订单/供应商/转ERP)",
                    "SELECT 单据编号, 单据日期, 采购订单号, 供应商, 是否已转ERP, ERP单号, 转ERP时间, asp_cancel"
                            + " FROM bd_purchase_in WHERE 单据编号 LIKE N'PI-2026-11-00%' ORDER BY 单据编号");
        }
    }

    static void sec(Connection c, String title, String sql) {
        System.out.println("\n--- " + title + " ---");
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (r.next()) {
                rows++;
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = r.getObject(i);
                    String t = v == null ? "NULL" : String.valueOf(v).trim();
                    if (t.length() > 70) t = t.substring(0, 70) + "…";
                    sb.append(t).append(i < n ? " | " : "");
                }
                System.out.println(sb);
            }
            if (rows == 0) System.out.println("(无数据)");
        } catch (Exception e) {
            System.out.println("[ERR] " + e.getMessage());
        }
    }
}
