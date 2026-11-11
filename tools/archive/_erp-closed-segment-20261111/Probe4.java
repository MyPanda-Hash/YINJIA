import java.sql.*;

/** 探针4:在服务器账套副本 HSDZ_MES_SRV 里定位 2026-11-11 的单据与 PI-2026-11-0036。 */
public class Probe4 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_SRV";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "A) 11 月全部采购入库单(编号/日期/订单/转ERP)",
                    "SELECT 单据编号,单据日期,采购订单号,批次号,是否已转ERP,ERP单号,转ERP时间,asp_cancel"
                            + " FROM bd_purchase_in WHERE 单据编号 LIKE N'PI-2026-11%' ORDER BY 单据编号");
            sec(c, "B) 编号含 0036 / 0034 / 0035 的单据(任意表头)",
                    "SELECT 单据编号,单据日期,采购订单号,是否已转ERP,ERP单号 FROM bd_purchase_in"
                            + " WHERE 单据编号 LIKE N'%0034%' OR 单据编号 LIKE N'%0035%' OR 单据编号 LIKE N'%0036%'");
            sec(c, "C) bl_purchase_in 里 2026-11-11 的行(按单据分组)",
                    "SELECT l.单据编号, COUNT(*) 行数, MIN(l.存货编码) 首行存货, SUM(l.实收数量) 数量合计"
                            + " FROM bl_purchase_in l JOIN bd_purchase_in h ON h.单据编号=l.单据编号"
                            + " WHERE h.单据日期 >= '2026-11-11' GROUP BY l.单据编号 ORDER BY l.单据编号");
            sec(c, "D) yj_doc_status 里 PI-2026-11-0036",
                    "SELECT doc_no, panel_code, shr, shsj, canceled, deleting, stopped, erp_close_state FROM yj_doc_status"
                            + " WHERE doc_no LIKE N'%0036%' OR doc_no LIKE N'PI-2026-11-00%' ORDER BY doc_no");
            sec(c, "E) 是否存在 PI-2026-11-0036 的痕迹(后端日志可疑;先看单据编号最大)",
                    "SELECT MAX(单据编号) 最大编号 FROM bd_purchase_in WHERE 单据编号 LIKE N'PI-2026-11%'");
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
