import java.sql.*;

/** 只读:本机实例有哪些库、哪张库里有 PI-2026-11-0038。 */
public class Probe3 {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://localhost:1433;databaseName=master;encrypt=false;trustServerCertificate=true;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT name, create_date FROM sys.databases ORDER BY name")) {
                while (r.next()) System.out.println(r.getString(1) + "  " + r.getString(2));
            }
            System.out.println("\n--- 各库是否有 PI-2026-11-0038 ---");
            java.util.List<String> dbs = new java.util.ArrayList<>();
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT name FROM sys.databases WHERE name LIKE 'HSDZ%' ORDER BY name")) {
                while (r.next()) dbs.add(r.getString(1));
            }
            for (String db : dbs) {
                try (Statement s2 = c.createStatement();
                     ResultSet r2 = s2.executeQuery("SELECT COUNT(*) FROM [" + db + "].dbo.bd_purchase_in WHERE 单据编号 = N'PI-2026-11-0038'")) {
                    r2.next();
                    System.out.println(db + " -> " + r2.getInt(1));
                } catch (Exception e) {
                    System.out.println(db + " -> [ERR] " + e.getMessage());
                }
            }
        }
    }
}
