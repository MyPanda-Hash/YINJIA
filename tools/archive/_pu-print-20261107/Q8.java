import java.sql.*;

/** 只读探针:确认 migrate-pu-print-20261107.sql 已登记 + 打印记录表当前为空。 */
public class Q8 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*) FROM yj_schema_log WHERE script_name LIKE ?")) {
                ps.setString(1, "%pu-print-20261107%");
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    System.out.println(db + " schema_log(pu-print)=" + rs.getInt(1));
                }
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT (SELECT COUNT(*) FROM bd_pu_print), (SELECT COUNT(*) FROM bl_pu_print)")) {
                rs.next();
                System.out.println(db + " bd_pu_print=" + rs.getInt(1) + " bl_pu_print=" + rs.getInt(2));
            }
        }
    }
}
