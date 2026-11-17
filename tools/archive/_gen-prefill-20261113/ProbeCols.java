import java.sql.*;

/**
 * 一次性取证(只读,第 3 版)—— 采购链四单的**全部物理列**(定位 仓库/仓位 到底落在哪张表哪一列)。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_gen-prefill-20261113/ProbeCols.java
 */
public class ProbeCols {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String t : new String[]{"sl_recv", "sl_recv_detail", "qc_insp_detail", "bl_purchase_in"}) {
                q(c, "| " + t + " 全部列",
                        "SELECT c.name AS col, ty.name AS typ, c.max_length AS len FROM sys.columns c "
                                + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                                + "WHERE c.object_id = OBJECT_ID('" + t + "') ORDER BY c.column_id");
            }
            q(c, "PU_ORDER 明细行里 仓库/仓位 的取值示例(近 8 行)",
                    "SELECT TOP 8 [行号],[物料编码],[仓库],[仓库编码],[仓位编码],[仓位名称] FROM bl_pu_order ORDER BY asp_time1 DESC");
            q(c, "QC_RECV 明细行的 仓库 取值示例(近 8 行)",
                    "SELECT TOP 8 * FROM sl_recv_detail ORDER BY 1 DESC");
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
                if (++n >= 12) break;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
