import java.sql.*;

/** 一次性只读探针:查 PI-2026-11-0036 转ERP「商品分录已关闭,不允许下推」的现场证据。 */
public class Probe {
    static final String DOC = "PI-2026-11-0036";
    static final String PO = "YJ-20261103-01";

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "1) 入库单头 bd_purchase_in",
                    "SELECT 单据编号,单据日期,采购订单号,批次号,供应商,是否已转ERP,ERP单号,转ERP操作人,转ERP时间,asp_cancel"
                            + " FROM bd_purchase_in WHERE 单据编号='" + DOC + "'");
            sec(c, "2) 入库单行 bl_purchase_in",
                    "SELECT * FROM bl_purchase_in WHERE 单据编号='" + DOC + "'");
            sec(c, "3) 采购订单头 bd_pu_order",
                    "SELECT * FROM bd_pu_order WHERE 单据编号='" + PO + "'");
            sec(c, "4) 采购订单行 bl_pu_order",
                    "SELECT * FROM bl_pu_order WHERE 单据编号='" + PO + "'");
            sec(c, "5) 引用该采购订单的全部入库单(谁先把分录用完了)",
                    "SELECT 单据编号,单据日期,采购订单号,是否已转ERP,ERP单号,转ERP时间,asp_cancel"
                            + " FROM bd_purchase_in WHERE 采购订单号='" + PO + "' ORDER BY 单据编号");
            sec(c, "6) 该订单在 yj_doc_status 的同步/关闭状态",
                    "SELECT * FROM yj_doc_status WHERE doc_no='" + PO + "'");
            sec(c, "7) 同订单各入库单行数量合计(看是否超/满订单量)",
                    "SELECT i.单据编号, i.是否已转ERP, l.存货编码, SUM(l.实收数量) 实收合计"
                            + " FROM bl_purchase_in l JOIN bd_purchase_in i ON i.单据编号=l.单据编号"
                            + " WHERE i.采购订单号='" + PO + "' AND ISNULL(i.asp_cancel,'N')<>'Y'"
                            + " GROUP BY i.单据编号, i.是否已转ERP, l.存货编码 ORDER BY i.单据编号");
            sec(c, "8) 该供应商/存货近期转ERP成功的入库单(对照组)",
                    "SELECT TOP 20 单据编号,单据日期,采购订单号,是否已转ERP,ERP单号,转ERP时间"
                            + " FROM bd_purchase_in WHERE 是否已转ERP=N'是' ORDER BY 转ERP时间 DESC");
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
                    String t = v == null ? "NULL" : String.valueOf(v);
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
