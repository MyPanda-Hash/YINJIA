import java.sql.*;

public class SqlProbe {
    public static void main(String[] args) throws Exception {
        String url = args.length > 0 ? args[0]
            : "jdbc:sqlserver://127.0.0.1:1433;encrypt=false;loginTimeout=8";
        String user = args.length > 1 ? args[1] : "bogus_user";
        String pass = args.length > 2 ? args[2] : "bogus_pass";
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("CONNECTED: " + c.getMetaData().getDatabaseProductVersion());
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT name FROM sys.databases ORDER BY name")) {
                while (rs.next()) System.out.println("DB: " + rs.getString(1));
            }
        } catch (SQLException e) {
            System.out.println("SQLSTATE=" + e.getSQLState() + " ERRCODE=" + e.getErrorCode());
            System.out.println("MSG=" + e.getMessage());
            if (e.getNextException() != null) System.out.println("CHAIN=" + e.getNextException().getMessage());
        }
    }
}
