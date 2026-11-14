import java.sql.*;

/** 只读:采购入库单 行级订单号到底有哪几列可用(源单编号 vs 本次新增的采购单号)。 */
public class ChkSrcCols {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT panel_code,label,col_name,place,seq,visible,hidden,editable,data_type "
                         + "FROM yj_field WHERE panel_code='PURCHASE_IN' AND (col_name IN (N'源单编号',N'采购单号') "
                         + "OR label IN (N'源单编号',N'采购单号')) ORDER BY seq")) {
                while (r.next()) {
                    System.out.println(r.getString(1) + " | label=" + r.getString(2) + " | col=" + r.getString(3)
                            + " | " + r.getString(4) + " seq=" + r.getInt(5) + " vis=" + r.getInt(6)
                            + " hid=" + r.getInt(7) + " edit=" + r.getInt(8) + " type=" + r.getString(9));
                }
            }
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT COUNT(*) total, "
                         + "SUM(CASE WHEN ISNULL(LTRIM(RTRIM([源单编号])),'')<>'' THEN 1 ELSE 0 END) has_src, "
                         + "SUM(CASE WHEN ISNULL(LTRIM(RTRIM([采购单号])),'')<>'' THEN 1 ELSE 0 END) has_po "
                         + "FROM bl_purchase_in")) {
                r.next();
                System.out.println("bl_purchase_in total=" + r.getInt(1) + " 源单编号有值=" + r.getInt(2)
                        + " 采购单号有值=" + r.getInt(3));
            }
        }
    }
}
