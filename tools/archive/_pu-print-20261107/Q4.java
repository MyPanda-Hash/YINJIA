import java.sql.*;

/** 只读探针:供应商账号清单(不打印口令哈希,只给长度/前缀,便于判断格式)。 */
public class Q4 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, username, supplier_code, enabled, real_name, phone, "
                 + "ISNULL(password_hash,N'') AS ph FROM yj_supplier_account ORDER BY id")) {
            while (rs.next()) {
                String ph = rs.getString("ph");
                System.out.println("id=" + rs.getInt("id") + " | username=" + rs.getString("username")
                    + " | supplier=" + rs.getString("supplier_code") + " | enabled=" + rs.getString("enabled")
                    + " | name=" + rs.getString("real_name") + " | phone=" + rs.getString("phone")
                    + " | hashLen=" + ph.length() + " | hashPrefix=" + ph.substring(0, Math.min(7, ph.length())));
            }
        }
    }
}
