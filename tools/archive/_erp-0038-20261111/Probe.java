import java.sql.*;

/**
 * 一次��只读探针:PI-2026-11-0038 转ERP 报「单据已关闭不允许下推或商品需检验,请先生成收料通知」的现场取证。
 * 只发 SELECT。运行:cd tools; java -cp lib\mssql-jdbc.jar ..\tools\archive\_erp-0038-20261111\Probe.java [库名]
 */
public class Probe {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== DB " + db + " ===");
            sec(c, "A) 单据头 PI-2026-11-0038",
                    "SELECT 单据编号, 单据日期, 采购订单号, 批次号, 供应商, 供应商编码, 入库类别, 经手人,"
                            + " 是否已转ERP, ERP单号, 转ERP操作人, 转ERP时间, asp_cancel, asp_state"
                            + " FROM bd_purchase_in WHERE 单据编号 = N'PI-2026-11-0038'");
            sec(c, "B) 单据行",
                    "SELECT 单据编号, 存货编码, 存货名称, 规格型号, 实收数量, 计量单位, 是否来料检验, 特采,"
                            + " 仓库, 仓库编码, 库存批号, 源单编号, 源单行号, 行备注, asp_cancel"
                            + " FROM bl_purchase_in WHERE 单据编号 = N'PI-2026-11-0038'");
            sec(c, "C) 同订单 YJ-20261102-02 在 MES 的全部入库单",
                    "SELECT 单据编号, 单据日期, 供应商, 是否已转ERP, ERP单号, 转ERP时间, asp_cancel"
                            + " FROM bd_purchase_in WHERE 采购订单号 = N'YJ-20261102-02' ORDER BY 单据日期, 单据编号");
            sec(c, "D) 订单 YJ-20261102-02 在 MES 的头/行(如有)",
                    "SELECT 单据编号, 单据日期, 供应商, 是否已转ERP, ERP单号, asp_cancel FROM bd_pu_order"
                            + " WHERE 单据编号 = N'YJ-20261102-02'");
            sec(c, "E) 该物料在 MES 的档案与检验相关列",
                    "SELECT TOP 5 * FROM bs_material WHERE 物料编码 IN (SELECT 存货编码 FROM bl_purchase_in"
                            + " WHERE 单据编号 = N'PI-2026-11-0038')");
            sec(c, "F) 同供应商近 20 张入库单(对照组,看 11 月谁转成功)",
                    "SELECT TOP 20 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号, 转ERP时间"
                            + " FROM bd_purchase_in WHERE 供应商 LIKE N'%' ORDER BY 转ERP时间 DESC");
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
                    if (t.length() > 80) t = t.substring(0, 80) + "…";
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
