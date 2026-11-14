import java.sql.*;

/** 全实例排查:列出所有库 → 逐库找 bd_purchase_in / bl_purchase_in 里的 PI-2026-11-0036。 */
public class Probe3 {
    static final String DOC = "PI-2026-11-0036";
    static final String PO = "YJ-20261103-01";

    public static void main(String[] a) throws Exception {
        String base = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(base, "yinjia", "Yinjia@2026")) {
            System.out.println("=== sys.databases ===");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT name, state_desc, create_date FROM sys.databases ORDER BY name")) {
                while (r.next()) System.out.println(r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3));
            }
        } catch (Exception e) {
            System.out.println("[master ERR] " + e.getMessage());
        }
        // 逐库
        java.util.List<String> dbs = new java.util.ArrayList<>();
        try (Connection c = DriverManager.getConnection(base, "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery("SELECT name FROM sys.databases WHERE state_desc='ONLINE'")) {
            while (r.next()) dbs.add(r.getString(1));
        } catch (Exception e) { System.out.println("[list ERR] " + e.getMessage()); }
        for (String db : dbs) {
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=10";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                if (!hasTable(c, "bd_purchase_in")) continue;
                System.out.println("\n=== DB " + db + " 有 bd_purchase_in ===");
                sec(c, "  计数",
                        "SELECT COUNT(*) 总数, SUM(CASE WHEN 单据编号 LIKE N'%PI-2026-11%' THEN 1 ELSE 0 END) 本月PI,"
                                + " SUM(CASE WHEN 单据编号 = N'" + DOC + "' THEN 1 ELSE 0 END) 命中0036,"
                                + " MAX(单据日期) 最新单据日期 FROM bd_purchase_in");
                sec(c, "  命中单据",
                        "SELECT 单据编号,单据日期,采购订单号,是否已转ERP,ERP单号,转ERP时间,asp_cancel"
                                + " FROM bd_purchase_in WHERE 单据编号 = N'" + DOC + "'");
                sec(c, "  最近10张",
                        "SELECT TOP 10 单据编号,单据日期,采购订单号,是否已转ERP,ERP单号 FROM bd_purchase_in"
                                + " ORDER BY 单据日期 DESC, 单据编号 DESC");
                if (hasTable(c, "bd_pu_order")) {
                    sec(c, "  订单" + PO,
                            "SELECT 单据编号,单据状态,关闭状态,[入库状态Z部分入库，C全部入库，A未入库] AS 入库状态,"
                                    + "是否已转ERP,ERP单号,转ERP时间,外部单据号 FROM bd_pu_order WHERE 单据编号 = N'" + PO + "'");
                    sec(c, "  引用该订单的入库单",
                            "SELECT 单据编号,单据日期,是否已转ERP,ERP单号,asp_cancel FROM bd_purchase_in WHERE 采购订单号 = N'" + PO + "'");
                }
            } catch (Exception e) {
                System.out.println("\n[DB " + db + " ERR] " + e.getMessage());
            }
        }
    }

    static boolean hasTable(Connection c, String t) {
        try (PreparedStatement p = c.prepareStatement(
                "SELECT 1 FROM sys.objects WHERE name = ? AND type IN ('U','V')")) {
            p.setString(1, t);
            try (ResultSet r = p.executeQuery()) { return r.next(); }
        } catch (Exception e) { return false; }
    }

    static void sec(Connection c, String title, String sql) {
        System.out.println("--- " + title + " ---");
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
