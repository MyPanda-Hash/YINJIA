import java.sql.*;

/** 只读探针:bl_pu_order 物理列(打印弹窗能引用的键以这里为准)。 */
public class Q2 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE "
                 + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_pu_order' ORDER BY ORDINAL_POSITION")) {
            while (rs.next()) {
                System.out.println(rs.getString(1) + " | " + rs.getString(2) + " | "
                    + rs.getObject(3) + "," + rs.getObject(4));
            }
        }
        System.out.println("---- sample rows ----");
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT TOP 1 * FROM bl_pu_order ORDER BY id DESC")) {
            ResultSetMetaData m = rs.getMetaData();
            while (rs.next()) {
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    if (v != null && !v.isBlank()) System.out.println(m.getColumnLabel(i) + " = " + v);
                }
            }
        }
    }
}
