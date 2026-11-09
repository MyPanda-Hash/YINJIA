import java.sql.*;

/** 只读:列出 bl_so_order 列(核对销售订单行字段名)。 */
public class Cols {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_so_order' ORDER BY ORDINAL_POSITION")) {
            StringBuilder sb = new StringBuilder();
            while (rs.next()) sb.append(rs.getString(1)).append(' ');
            System.out.println(sb);
        }
    }
}
