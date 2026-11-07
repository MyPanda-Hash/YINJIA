import java.sql.*;

/** 一次性清理:删掉本次界面/接口实测产生的打印记录(MP-2026-11-0001..0003,均已作废)。 */
public class Q7 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String in = "'MP-2026-11-0001','MP-2026-11-0002','MP-2026-11-0003'";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            int lines, heads;
            try (Statement st = c.createStatement()) {
                lines = st.executeUpdate("DELETE FROM bl_pu_print WHERE [单据编号] IN (" + in + ")");
            }
            try (Statement st = c.createStatement()) {
                heads = st.executeUpdate("DELETE FROM bd_pu_print WHERE [单据编号] IN (" + in + ")");
            }
            System.out.println(db + " cleaned lines=" + lines + " heads=" + heads);
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT (SELECT COUNT(*) FROM bd_pu_print) AS h, (SELECT COUNT(*) FROM bl_pu_print) AS l")) {
                rs.next();
                System.out.println(db + " remaining bd_pu_print=" + rs.getInt("h") + " bl_pu_print=" + rs.getInt("l"));
            }
        }
    }
}
