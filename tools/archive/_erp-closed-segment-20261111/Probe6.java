import java.sql.*;

/** 探针6:服务器账套快照里,11 月 YJ-KBL-002 的送料/暂收来源(看 12000 从哪来)。 */
public class Probe6 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_SRV";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "A) 含 recv/送料 的表与视图",
                    "SELECT name, type_desc FROM sys.objects WHERE (name LIKE N'%recv%' OR name LIKE N'%送料%') AND type IN ('U','V')");
            sec(c, "B) 11 月采购入库单头(全部)",
                    "SELECT 单据编号,单据日期,采购订单号,批次号,是否已转ERP FROM bd_purchase_in WHERE 单据编号 LIKE N'PI-2026-11%' ORDER BY 单据编号");
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
                    if (t.length() > 60) t = t.substring(0, 60) + "…";
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
