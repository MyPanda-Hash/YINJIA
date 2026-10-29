import java.sql.*;

/**
 * 只读探针:找「有多个批次号」的商品(物料编码)。
 * 口径:kucun(结存,三键 物料/仓库/批号)按物料统计 DISTINCT 批号数。
 * 用法:java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_qmultilotitems.java [库名] [指定物料编码]
 */
public class _qmultilotitems {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("== DB: " + db + " ==");

            String sql =
                "SELECT TOP 30 k.wzdm AS 物料编码, "
              + "  MAX(ISNULL(m.mc, N'')) AS 物料名称, "
              + "  COUNT(DISTINCT k.lot_no) AS 批号数, "
              + "  COUNT(*) AS 库存行数, "
              + "  SUM(k.yl) AS 现存量合计 "
              + "FROM kucun k "
              + "LEFT JOIN (SELECT 存货编码, MAX(存货名称) AS mc, MAX(规格型号) AS gg FROM bs_inv WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 存货编码) m "
              + "  ON m.存货编码 = k.wzdm "
              + "WHERE k.lot_no IS NOT NULL AND LTRIM(RTRIM(k.lot_no)) <> N'' "
              + "GROUP BY k.wzdm "
              + "HAVING COUNT(DISTINCT k.lot_no) > 1 "
              + "ORDER BY COUNT(DISTINCT k.lot_no) DESC, COUNT(*) DESC";
            String first = null;
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
                System.out.println("-- 按批号数排序 TOP 30 --");
                while (r.next()) {
                    if (first == null) first = r.getString(1);
                    System.out.printf("%-22s | %-30s | 批号数=%3d | 行数=%3d | 现存=%s%n",
                        r.getString(1), r.getString(2), r.getInt(3), r.getInt(4), r.getBigDecimal(5));
                }
            }

            String cnt = "SELECT COUNT(*) AS n FROM (SELECT wzdm FROM kucun "
                       + "WHERE lot_no IS NOT NULL AND LTRIM(RTRIM(lot_no)) <> N'' "
                       + "GROUP BY wzdm HAVING COUNT(DISTINCT lot_no) > 1) t";
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(cnt)) {
                r.next();
                System.out.println("-- 多批次商品总数: " + r.getInt(1));
            }

            String one = a.length > 1 ? a[1] : first;
            if (one != null) {
                System.out.println("-- 样本物料 " + one + " 的批次明细(kucun) --");
                String d = "SELECT ckdm, lot_no, rkl, ckl, yl "
                         + "FROM kucun WHERE wzdm = ? ORDER BY lot_no, ckdm";
                try (PreparedStatement p = c.prepareStatement(d)) {
                    p.setString(1, one);
                    try (ResultSet r = p.executeQuery()) {
                        while (r.next()) {
                            System.out.printf("  仓库=%-10s | 批号=%-14s | 入=%12s 出=%12s 存=%12s%n",
                                r.getString(1), r.getString(2), r.getBigDecimal(3), r.getBigDecimal(4), r.getBigDecimal(5));
                        }
                    }
                }
            }
        }
    }
}
