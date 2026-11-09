import java.sql.*;

/** 只读:超送比例参数现值 + 更新时间(核对材料码 15% / 打印 20% 的差异)。 */
public class U11 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT setting_key, setting_value, remark, asp_user1,"
                 + " CONVERT(varchar(19), asp_time1, 120) AS t1, CONVERT(varchar(19), asp_time2, 120) AS t2"
                 + " FROM yj_app_setting WHERE setting_key='receive_over_ratio'")) {
            while (rs.next()) {
                System.out.println("receive_over_ratio = " + rs.getString(2)
                    + " | asp_user1=" + rs.getString(4) + " | asp_time1=" + rs.getString(5) + " | asp_time2=" + rs.getString(6));
                System.out.println("remark=" + rs.getString(3));
            }
        }
    }
}
