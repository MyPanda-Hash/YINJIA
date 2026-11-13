import java.sql.*;

/** 只读探针2:确认 PI-2026-11-0036 到底在不在库、采购入库单面板的物理表、以及订单 YJ-20261103-01 的入库/关闭状态。 */
public class Probe2 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " @ " + db + " ===");
            sec(c, "A) PURCHASE_IN 面板物理表(yj_panel)",
                    "SELECT id, code, name, table_name FROM yj_panel WHERE code IN ('PURCHASE_IN','PU_ORDER','QC_RETURN')");
            sec(c, "B) bd_purchase_in LIKE PI-2026-11* (最近30张)",
                    "SELECT TOP 30 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号, 转ERP时间, asp_cancel"
                            + " FROM bd_purchase_in WHERE 单据编号 LIKE N'%PI-2026-11%' ORDER BY 单据编号 DESC");
            sec(c, "C) bd_purchase_in 全表最近20张(按单据日期)",
                    "SELECT TOP 20 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号, 转ERP时间"
                            + " FROM bd_purchase_in ORDER BY 单据日期 DESC, 单据编号 DESC");
            sec(c, "D) 单据编号含 0036 的入库单(模糊)",
                    "SELECT 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号"
                            + " FROM bd_purchase_in WHERE 单据编号 LIKE N'%0036%'");
            sec(c, "E) 订单 YJ-20261103-01 关键状态列",
                    "SELECT 单据编号, 单据状态, 关闭状态, [入库状态Z部分入库，C全部入库，A未入库] AS 入库状态,"
                            + " [实际出入库状态], 是否已转ERP, ERP单号, 转ERP时间, 外部单据号, 外部数据ID"
                            + " FROM bd_pu_order WHERE 单据编号 = N'YJ-20261103-01'");
            sec(c, "F) 订单行:数量/已执行/关闭状态",
                    "SELECT 分录序号, 行号, 物料编码, 数量, 行已执行数量, 行未执行数量, [行关闭状态], [行入库状态], [行执行状态]"
                            + " FROM bl_pu_order WHERE 单据编号 = N'YJ-20261103-01' ORDER BY 行号");
            sec(c, "G) 该订单被几张入库单引用(含已取消)",
                    "SELECT 单据编号, 单据日期, 是否已转ERP, ERP单号, asp_cancel FROM bd_purchase_in WHERE 采购订单号 = N'YJ-20261103-01'");
            sec(c, "H) 该订单行在入库行表里出现的源单行号/数量",
                    "SELECT l.单据编号, l.存货编码, l.实收数量, l.源单编号, l.源单行号, l.源单分录id"
                            + " FROM bl_purchase_in l WHERE l.源单编号 = N'YJ-20261103-01' OR l.单据编号 IN"
                            + " (SELECT 单据编号 FROM bd_purchase_in WHERE 采购订单号 = N'YJ-20261103-01')");
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
