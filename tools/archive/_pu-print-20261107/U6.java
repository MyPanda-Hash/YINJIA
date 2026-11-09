import java.sql.*;

/** 只读:本地 10 月起采购/销售订单条数 + 生单链/材料码是否已引用这些行(评估重拉风险)。 */
public class U6 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            one(c, "采购订单(>=2026-10-01)",
                "SELECT COUNT(*) FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-10-01'");
            one(c, "采购订单(全部存活)",
                "SELECT COUNT(*) FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y'");
            one(c, "销售订单(>=2026-10-01)",
                "SELECT COUNT(*) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-10-01'");
            one(c, "销售订单(全部存活)",
                "SELECT COUNT(*) FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'");
            one(c, "form_flow_link 引用采购订单行(10月起)",
                "SELECT COUNT(*) FROM form_flow_link WHERE source_line_key LIKE N'%#%' AND source_line_key IN ("
                    + "SELECT 单据编号 + N'#' + CONVERT(nvarchar(20), id) FROM bl_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " AND 单据编号 IN (SELECT 单据编号 FROM bd_pu_order WHERE 单据日期 >= '2026-10-01'))");
            one(c, "bd_pu_label 登记行(10月起订单)",
                "SELECT COUNT(*) FROM bl_pu_label WHERE 采购订单行id IN (SELECT l.id FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号"
                    + " WHERE h.单据日期 >= '2026-10-01')");
            one(c, "form_flow_link 引用销售订单行(10月起)",
                "SELECT COUNT(*) FROM form_flow_link WHERE source_line_key IN ("
                    + "SELECT 单据编号 + N'#' + CONVERT(nvarchar(20), id) FROM bl_so_order WHERE ISNULL(asp_cancel,'N')<>'Y'"
                    + " AND 单据编号 IN (SELECT 单据编号 FROM bd_so_order WHERE 单据日期 >= '2026-10-01'))");
            System.out.println("--- form_flow_link 列 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION")) {
                StringBuilder sb = new StringBuilder();
                while (rs.next()) sb.append(rs.getString(1)).append(' ');
                System.out.println(sb);
            }
        }
    }

    private static void one(Connection c, String label, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            System.out.println(label + " = " + rs.getInt(1));
        }
    }
}
