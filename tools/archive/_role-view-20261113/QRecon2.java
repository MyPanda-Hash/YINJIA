// QRecon2.java —— 走查前的账号/角色/面板盘点(只读) 用法: ... QRecon2.java <DB>
import java.sql.*;
import java.nio.file.*;

public class QRecon2 {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false";

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        StringBuilder sb = new StringBuilder("# DB=" + db + "\n");
        try (Connection c = DriverManager.getConnection(String.format(URL, db), "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            rs(s, sb, "SELECT u.username, u.real_name, u.is_admin, u.enabled, r.role_code, r.role_name "
                    + "FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id ORDER BY u.id", 60);
            sb.append("\n== 面板 QC_RECV 是否存在 ==\n");
            rs(s, sb, "SELECT panel_code, panel_name, mode, module_group FROM yj_panel WHERE panel_code IN ('QC_RECV','SL_RECV','PU_ORDER')", 10);
            sb.append("\n== QC_RECV 字段(前 20) ==\n");
            rs(s, sb, "SELECT TOP 20 place, seq, col_name, label, hidden, visible, required FROM yj_field "
                    + "WHERE RTRIM(panel_code)='QC_RECV' ORDER BY place, seq", 30);
            sb.append("\n== yj_field_view 现状 ==\n");
            rs(s, sb, "SELECT COUNT(*) AS n FROM yj_field_view", 5);
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-recon2-out.txt"), sb.toString());
        System.out.println("written");
    }

    static void rs(Statement s, StringBuilder sb, String sql, int max) {
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = 0;
            while (r.next()) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
                sb.append("\n");
                if (++n >= max) break;
            }
            if (n == 0) sb.append("  (0 rows)\n");
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
