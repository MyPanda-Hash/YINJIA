import java.sql.*;

/** 只读:金蝶导入的采购订单在本地靠什么显示「已审核」(物理列 vs yj_doc_status)。 */
public class U7 {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                     + "WHERE TABLE_NAME='bd_pu_order' AND COLUMN_NAME IN (N'单据状态',N'是否已转ERP',N'外部数据ID')")) {
                while (rs.next()) System.out.println("bd_pu_order 有列: " + rs.getString(1));
            }
            System.out.println("--- yj_doc_status(PU_ORDER 10月起) ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) AS n FROM yj_doc_status WHERE panel_code='PU_ORDER' "
                     + "AND doc_no IN (SELECT 单据编号 FROM bd_pu_order WHERE 单据日期 >= '2026-10-01')")) {
                rs.next();
                System.out.println("有状态行的单据数 = " + rs.getInt(1));
            }
            System.out.println("--- 抽样 3 张 10 月单据 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 3 h.[单据编号], h.[是否已转ERP], h.[ERP单号],"
                     + " (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=h.[单据编号] AND s.shr IS NOT NULL) AS audited"
                     + " FROM bd_pu_order h WHERE h.单据日期 >= '2026-10-01' ORDER BY h.单据日期 DESC")) {
                while (rs.next()) System.out.println(rs.getString(1) + " 已转ERP=" + rs.getString(2)
                    + " ERP单号=" + rs.getString(3) + " yj_doc_status审核行=" + rs.getInt(4));
            }
        }
    }
}
