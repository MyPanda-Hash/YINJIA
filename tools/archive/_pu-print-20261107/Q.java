import java.sql.*;

/** 只读探针:打印采购订单弹窗要用的明细字段顺序(PU_ORDER, place 含 detail)。 */
public class Q {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String sql = "SELECT seq, label, col_name, place, visible, hidden, id "
            + "FROM yj_field WHERE panel_code='PU_ORDER' AND place LIKE '%detail%' ORDER BY seq, id";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                System.out.println(rs.getInt(1) + " | " + rs.getString(2) + " | " + rs.getString(3)
                    + " | " + rs.getString(4) + " | vis=" + rs.getInt(5) + " hid=" + rs.getInt(6));
            }
        }
        System.out.println("---- head fields (place like header/query) ----");
        String sql2 = "SELECT seq, label, col_name, place FROM yj_field "
            + "WHERE panel_code='PU_ORDER' AND (place LIKE '%header%' OR place='query') ORDER BY seq, id";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql2)) {
            while (rs.next()) {
                System.out.println(rs.getInt(1) + " | " + rs.getString(2) + " | " + rs.getString(3) + " | " + rs.getString(4));
            }
        }
    }
}
