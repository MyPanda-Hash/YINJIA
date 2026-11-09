import java.sql.*;

/** 只读:找一张采购订单草稿(用于界面验证"数量按单位取整",只改界面不保存)。 */
public class U5 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT TOP 8 h.[单据编号], h.[供应商], COUNT(l.id) AS lines FROM bd_pu_order h"
                     + " LEFT JOIN bl_pu_order l ON l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'"
                     + " WHERE ISNULL(h.asp_cancel,'N')<>'Y'"
                     + "   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=h.[单据编号] AND s.shr IS NOT NULL)"
                     + " GROUP BY h.[单据编号], h.[供应商] ORDER BY h.[单据编号] DESC")) {
            while (rs.next()) System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | lines=" + rs.getInt(3));
        }
    }
}
