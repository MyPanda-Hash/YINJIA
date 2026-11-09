import java.sql.*;

/** 只读探针:校验 bd_pu_print/bl_pu_print 建表、列数、中文注明、索引(两个账套各跑一次)。 */
public class Q6 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String t : new String[]{"bd_pu_print", "bl_pu_print"}) {
                int cols = one(c, "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo." + t + "')");
                int tblDesc = one(c, "SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo." + t + "') AND minor_id=0 AND name=N'MS_Description'");
                int colDesc = one(c, "SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo." + t + "') AND minor_id>0 AND name=N'MS_Description'");
                System.out.println(db + " | " + t + " cols=" + cols + " tableDesc=" + tblDesc + " colDesc=" + colDesc);
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT name FROM sys.indexes WHERE object_id IN (OBJECT_ID(N'dbo.bd_pu_print'),OBJECT_ID(N'dbo.bl_pu_print')) ORDER BY name")) {
                while (rs.next()) System.out.println("index: " + rs.getString(1));
            }
        }
    }

    private static int one(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }
}
