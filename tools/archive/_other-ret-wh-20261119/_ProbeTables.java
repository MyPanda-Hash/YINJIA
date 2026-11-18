import java.sql.*;

/** 探针:列出 yj_ 开头的状态/留痕类表(删测试单时要连带清干净,免得留脏数据)。 */
public class _ProbeTables {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                 "SELECT name FROM sys.tables WHERE name LIKE 'yj_%' "
                 + "AND (name LIKE '%trail%' OR name LIKE '%log%' OR name LIKE '%status%' OR name LIKE '%flow%') ORDER BY name")) {
            while (rs.next()) System.out.println("  " + rs.getString(1));
        } catch (SQLException e) {
            System.out.println("ERR " + e.getMessage());
        }
    }
}
