import java.sql.*;

/** 探针7:服务器账套快照里,11 月送料暂收(sl_recv)中 YJ-KBL-002 的记录 + 该物料 11 月入库行。 */
public class Probe7 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_SRV";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "A) sl_recv 列名",
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv' ORDER BY ORDINAL_POSITION");
            sec(c, "B) sl_recv_detail 列名",
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv_detail' ORDER BY ORDINAL_POSITION");
            sec(c, "C) 11 月送料暂收单头",
                    "SELECT * FROM sl_recv WHERE 单据日期 >= '2026-11-01' ORDER BY 单据日期 DESC");
        }
    }

    static void sec(Connection c, String title, String sql) {
        System.out.println("\n--- " + title + " ---");
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? "," : "");
            System.out.println(h);
            int rows = 0;
            while (r.next()) {
                rows++;
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = r.getObject(i);
                    String t = v == null ? "NULL" : String.valueOf(v).trim();
                    if (t.length() > 50) t = t.substring(0, 50) + "…";
                    sb.append(t).append(i < n ? "," : "");
                }
                System.out.println(sb);
            }
            if (rows == 0) System.out.println("(无数据)");
        } catch (Exception e) {
            System.out.println("[ERR] " + e.getMessage());
        }
    }
}
