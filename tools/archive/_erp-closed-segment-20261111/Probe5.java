import java.sql.*;

/** 探针5:在服务器账套快照 HSDZ_MES_SRV 里查 YJ-KBL-002 的入库/送料历史,找出「谁把订单该行收满」。 */
public class Probe5 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_SRV";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        String item = a.length > 1 ? a[1] : "YJ-KBL-002";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " 物料 " + item + " ===");
            sec(c, "A) 采购入库单行(该物料,含转ERP状态)",
                    "SELECT h.单据编号, h.单据日期, h.批次号, h.采购订单号, h.是否已转ERP, h.ERP单号, h.转ERP时间,"
                            + " l.存货编码, l.实收数量, l.源单编号, l.源单行号, h.asp_cancel"
                            + " FROM bl_purchase_in l JOIN bd_purchase_in h ON h.单据编号 = l.单据编号"
                            + " WHERE l.存货编码 = N'" + item + "' ORDER BY h.单据日期 DESC, h.单据编号 DESC");
            sec(c, "B) 送料暂收单行(该物料)",
                    "SELECT h.单号, h.单据日期, h.批次号, h.采购订单号, l.物料编码, l.送检数量, h.asp_cancel"
                            + " FROM (SELECT 单号, 单据日期, 批次号, 采购订单号, asp_cancel FROM qc_recv) h"
                            + " JOIN qc_recv_detail l ON l.单号 = h.单号 WHERE l.物料编码 = N'" + item + "'"
                            + " ORDER BY h.单据日期 DESC");
            sec(c, "C) 该物料在订单 YJ-20261103-01 上的入库总量(MES 侧)",
                    "SELECT SUM(l.实收数量) 合计, COUNT(*) 行数 FROM bl_purchase_in l JOIN bd_purchase_in h ON h.单据编号 = l.单据编号"
                            + " WHERE l.存货编码 = N'" + item + "' AND h.采购订单号 = N'YJ-20261103-01'"
                            + " AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(h.是否已转ERP,N'否') = N'是'");
            sec(c, "D) 订单 YJ-20261103-01 目前 MES 侧已转ERP的入库单",
                    "SELECT 单据编号, 单据日期, 是否已转ERP, ERP单号, 转ERP时间 FROM bd_purchase_in"
                            + " WHERE 采购订单号 = N'YJ-20261103-01' ORDER BY 单据日期");
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
