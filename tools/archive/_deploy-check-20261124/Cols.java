import java.sql.*;

/** 只读:列出本地库某表列定义(本次用于 qc_sample_reg 造数前的列宽/必填核对)。 */
public class Cols {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String tbl = a.length > 1 ? a[1] : "qc_sample_reg";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery(
                     "SELECT name, TYPE_NAME(user_type_id) t, max_length, is_nullable, is_identity "
                   + "FROM sys.columns WHERE object_id = OBJECT_ID('dbo." + tbl + "') ORDER BY column_id")) {
            while (r.next()) {
                System.out.printf("%-20s %-14s len=%-6d null=%d identity=%d%n",
                        r.getString(1), r.getString(2), r.getInt(3), r.getInt(4), r.getInt(5));
            }
        }
    }
}
