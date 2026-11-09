import java.sql.*;

/** 只读:核对刚补拉的采购/销售订单(单据状态镜像、行数、单位)。 */
public class U8 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String[] t : new String[][]{
                {"采购订单", "bd_pu_order", "bl_pu_order", "PU_ORDER", "单据编号", "供应商"},
                {"销售订单", "bd_so_order", "bl_so_order", "SO_ORDER", "单据编号", "客户"}}) {
                System.out.println("--- " + t[0] + " 最近 5 张(10 月起) ---");
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery(
                         "SELECT TOP 5 h.单据编号, h.单据日期, h." + t[5] + " AS partner,"
                             + " (SELECT COUNT(*) FROM " + t[2] + " l WHERE l.单据编号=h.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') AS lines,"
                             + " (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='" + t[3] + "' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL) AS audited"
                             + " FROM " + t[1] + " h WHERE h.单据日期 >= '2026-10-01' ORDER BY h.单据日期 DESC, h.单据编号 DESC")) {
                    while (rs.next()) {
                        System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " | "
                            + rs.getString(3) + " | 行数=" + rs.getInt(4) + " | 状态行=" + rs.getInt(5));
                    }
                }
            }
            System.out.println("--- 计数 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                     "SELECT (SELECT COUNT(*) FROM bd_pu_order WHERE 单据日期 >= '2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y'),"
                         + " (SELECT COUNT(*) FROM bd_so_order WHERE 单据日期 >= '2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y')")) {
                rs.next();
                System.out.println("采购订单(10月起)=" + rs.getInt(1) + " 销售订单(10月起)=" + rs.getInt(2));
            }
        }
    }
}
