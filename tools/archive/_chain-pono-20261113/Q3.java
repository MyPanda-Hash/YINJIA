import java.sql.*;

/** 只读:qc_return_detail 的数量列名(退货回冲 SQL 要按真实列取)。 */
public class Q3 {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_return_detail') "
                         + "AND (c.name LIKE N'%数量%' OR c.name LIKE N'%特采%' OR c.name LIKE N'%单位%') ORDER BY c.column_id")) {
                while (r.next()) System.out.println("col: " + r.getString(1));
            }
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT COUNT(*) t, SUM(CASE WHEN ISNULL(特采,0)=1 THEN 1 ELSE 0 END) tc FROM qc_return_detail")) {
                r.next();
                System.out.println("qc_return_detail 行数=" + r.getInt(1) + " 特采勾选行=" + r.getInt(2));
            }
        }
    }
}
