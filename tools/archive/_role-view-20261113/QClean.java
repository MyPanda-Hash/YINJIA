// QClean.java —— 走查收尾:清临时账号 + 打印两账套关键对账(幂等,可重复跑)
// 用法: java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QClean.java
import java.sql.*;
import java.nio.file.*;

public class QClean {
    public static void main(String[] a) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026")) {
                sb.append("== ").append(db).append(" ==\n");
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM yj_user WHERE username LIKE 'zz_fv_%'")) {
                    sb.append("  删除临时账号 ").append(ps.executeUpdate()).append(" 个\n");
                }
                try (PreparedStatement ps = c.prepareStatement("DELETE FROM yj_field_view WHERE role_code IN ('xiaoshou','admin','ckgl')")) {
                    sb.append("  清理走查遗留覆盖行 ").append(ps.executeUpdate()).append(" 行\n");
                } catch (SQLException e) {
                    sb.append("  (yj_field_view 不存在,跳过) ").append(e.getMessage()).append("\n");
                }
                try (Statement s = c.createStatement()) {
                    dump(s, sb, "SELECT COUNT(*) AS 覆盖行 FROM yj_field_view");
                    dump(s, sb, "SELECT COUNT(*) AS 临时账号 FROM yj_user WHERE username LIKE 'zz_fv_%'");
                    dump(s, sb, "SELECT COUNT(*) AS 字段行, CHECKSUM_AGG(BINARY_CHECKSUM(panel_code, place, seq, col_name, label, alias, hidden, visible, editable, required)) AS 校验和 FROM yj_field");
                }
                sb.append("\n");
            }
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-clean-out.txt"), sb.toString());
        System.out.println("written");
    }

    static void dump(Statement s, StringBuilder sb, String sql) {
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            while (r.next()) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append("  ");
                sb.append("\n");
            }
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
