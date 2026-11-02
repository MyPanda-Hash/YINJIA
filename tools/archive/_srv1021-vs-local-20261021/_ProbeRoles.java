import java.sql.*;

/** Probe: server roles / permissions of the connected login. Read-only. */
public class _ProbeRoles {
    public static void main(String[] args) throws Exception {
        String url = args[0], user = args[1], pass = args[2];
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement()) {
            System.out.println("user=" + user + " db=" + c.getCatalog());
            q(st, "SELECT SUSER_NAME() AS login_name, IS_SRVROLEMEMBER('sysadmin') AS is_sa, "
                 + "IS_SRVROLEMEMBER('dbcreator') AS is_dbcreator, "
                 + "IS_SRVROLEMEMBER('securityadmin') AS is_secadmin, "
                 + "IS_SRVROLEMEMBER('serveradmin') AS is_serveradmin");
            q(st, "SELECT name, type_desc FROM sys.server_principals WHERE type IN ('S','U') ORDER BY name");
            q(st, "SELECT p.permission_name, p.state_desc FROM fn_my_permissions(NULL, 'SERVER') p");
            q(st, "SELECT IS_SRVROLEMEMBER('sysadmin') AS a, HAS_PERMS_BY_NAME(NULL,NULL,'CONTROL SERVER') AS b");
        }
    }
    static void q(Statement st, String sql) {
        System.out.println("-- " + sql);
        try (ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append('=').append(rs.getString(i)).append("  ");
                System.out.println(sb);
            }
        } catch (SQLException e) { System.out.println("   [ERR] " + e.getMessage()); }
    }
}
