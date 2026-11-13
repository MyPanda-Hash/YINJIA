import java.sql.*;

/**
 * 一次性取证(只读,第 2 版)—— 仓位/仓库 相关**物理列**与**存量数据**,为「采购订单生单时预填仓库仓位」定位。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_gen-prefill-20261113/ProbeWhCols.java [库名]
 */
public class ProbeWhCols {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== 库 " + db + " ===");
            q(c, "采购链各表的物理表名(yj_panel head/line)",
                    "SELECT panel_code, head_table, line_table FROM yj_panel WHERE panel_code IN "
                            + "(N'PU_ORDER',N'QC_RECV',N'QC_INSP',N'PURCHASE_IN',N'QC_RETURN',N'SALE_OUT',N'SO_ORDER')");
            for (String t : new String[]{"bl_pu_order", "bl_pu_order_detail", "qc_recv", "qc_recv_detail",
                    "qc_insp", "qc_insp_detail", "bl_purchase_in", "bl_purchase_in_detail", "sale_out", "sale_out_detail"}) {
                q(c, "| " + t + " 里仓库/仓位相关列",
                        "SELECT c.name AS col, ty.name AS typ, c.max_length AS len, CAST(ep.value AS nvarchar(120)) AS note "
                                + "FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                                + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_DESCRIPTION' "
                                + "WHERE c.object_id = OBJECT_ID('" + t + "') AND (c.name LIKE N'%仓位%' OR c.name LIKE N'%仓库%' "
                                + "OR c.name LIKE N'%库位%' OR c.name LIKE N'%wh%') ORDER BY c.column_id");
            }
            q(c, "采购订单行:仓库列有值比例(近 30 行)",
                    "SELECT TOP 30 [行号],[物料编码],[仓库],[仓库编码],[仓位编码],[仓位名称] FROM bl_pu_order_detail ORDER BY asp_time1 DESC");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n-- " + title + " --");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(head);
            int n = 0;
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(v == null ? "(null)" : v).append(i < m.getColumnCount() ? " | " : "");
                }
                System.out.println(row);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
