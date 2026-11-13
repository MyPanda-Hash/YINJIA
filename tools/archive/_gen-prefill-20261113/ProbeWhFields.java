import java.sql.*;

/**
 * 一次性取证(只读):采购链四张单(PU_ORDER / QC_RECV / QC_INSP / PURCHASE_IN)及其它出库单上
 * 「仓库 / 仓位 / 库位」相关字段的登记情况 —— 为「生单时预填仓库仓位」定位字段与物理列。
 *
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_gen-prefill-20261113/ProbeWhFields.java [库名]
 */
public class ProbeWhFields {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== 库 " + db + " ===");
            q(c, "yj_field 里带 仓库/仓位/库位 的字段(按面板)",
                    "SELECT panel_code, label, col_name, place, seq, visible, hidden, editable "
                            + "FROM yj_field WHERE (label LIKE N'%仓库%' OR label LIKE N'%仓位%' OR label LIKE N'%库位%') "
                            + "ORDER BY panel_code, place, seq");
            q(c, "目标面板是否登记了 批次号/采购订单号 等生单头字段(对照用)",
                    "SELECT panel_code, label, place, seq FROM yj_field WHERE panel_code IN (N'PU_ORDER',N'QC_RECV') "
                            + "AND place = N'header' ORDER BY panel_code, seq");
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
