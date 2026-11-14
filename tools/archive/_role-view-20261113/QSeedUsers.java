// QSeedUsers.java —— 走查用临时账号(仅在测试库 HSDZ_MES_TEST 用;可一键清理)
// 用法: 创建 java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QSeedUsers.java create
//       清理 java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QSeedUsers.java cleanup
import java.sql.*;

public class QSeedUsers {
    static final String DB = "HSDZ_MES_TEST";
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false";
    /** 明文 Tmp#FieldView2026 的 bcrypt(由 QGenHash 生成,已 verify=true) */
    static final String HASH = "$2a$10$WoE3koB3qicLqfwijbkMROJdv5TpFVv2QEyjSq1TYz4wvH8AnAHtC";
    static final String[][] USERS = {
            {"zz_fv_a", "字段视图走查A", "1029"},   // 销售
            {"zz_fv_b", "字段视图走查B", "1031"},   // 仓库管理
    };

    public static void main(String[] a) throws Exception {
        String mode = a.length > 0 ? a[0] : "create";
        try (Connection c = DriverManager.getConnection(URL, "yinjia", "Yinjia@2026")) {
            c.setAutoCommit(false);
            try {
                for (String[] u : USERS) {
                    if ("cleanup".equals(mode)) {
                        try (PreparedStatement ps = c.prepareStatement("DELETE FROM yj_user WHERE username = ?")) {
                            ps.setString(1, u[0]);
                            System.out.println("删除 " + u[0] + " -> " + ps.executeUpdate());
                        }
                    } else {
                        try (PreparedStatement del = c.prepareStatement("DELETE FROM yj_user WHERE username = ?")) {
                            del.setString(1, u[0]);
                            del.executeUpdate();
                        }
                        try (PreparedStatement ps = c.prepareStatement(
                                "INSERT INTO yj_user (username, password_hash, real_name, is_admin, role_id, enabled)"
                                        + " VALUES (?,?,?,'N',?,'1')")) {
                            ps.setString(1, u[0]);
                            ps.setString(2, HASH);
                            ps.setString(3, u[1]);
                            ps.setInt(4, Integer.parseInt(u[2]));
                            ps.executeUpdate();
                            System.out.println("创建 " + u[0] + " (role_id=" + u[2] + ")");
                        }
                    }
                }
                c.commit();
                // 收尾自检:打印当前临时账号与其角色
                try (Statement s = c.createStatement();
                     ResultSet r = s.executeQuery(
                             "SELECT u.username, u.role_id, r.role_code FROM yj_user u LEFT JOIN yj_role r ON r.id=u.role_id"
                                     + " WHERE u.username LIKE 'zz_fv_%' ORDER BY u.username")) {
                    while (r.next()) System.out.println("  残留 " + r.getString(1) + " role=" + r.getString(3));
                }
            } catch (Exception e) {
                c.rollback();
                throw e;
            }
        }
    }
}
