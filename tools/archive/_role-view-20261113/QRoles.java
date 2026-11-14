// QRoles.java —— 查某面板在测试库被哪些角色授权(只读) 用法: ... QRoles.java <DB> <panelCode>
import java.sql.*;
import java.nio.file.*;

public class QRoles {
    public static void main(String[] a) throws Exception {
        String db = a[0], panel = a[1];
        StringBuilder sb = new StringBuilder("# " + db + " / " + panel + "\n");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery(
                     "SELECT r.id, r.role_code, r.role_name, rp.perms FROM yj_role_panel rp "
                             + "JOIN yj_role r ON r.id = rp.role_id WHERE RTRIM(rp.panel_code) = '" + panel + "' ORDER BY r.id")) {
            while (r.next()) {
                sb.append("  id=").append(r.getInt(1)).append(" | ").append(r.getString(2))
                        .append(" | ").append(r.getString(3)).append(" | ").append(r.getString(4)).append("\n");
            }
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-roles-out.txt"), sb.toString());
        System.out.println("written");
    }
}
