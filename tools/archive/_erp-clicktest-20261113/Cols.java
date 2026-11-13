import java.sql.*;

/** 只读:kucun 表的列名(库存表用的是英语列还是中文列)。 */
public class Cols {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery("SELECT c.name, ty.name FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                     + "WHERE c.object_id=OBJECT_ID('kucun') ORDER BY c.column_id")) {
            while (r.next()) System.out.println(r.getString(1) + " (" + r.getString(2) + ")");
        }
    }
}
