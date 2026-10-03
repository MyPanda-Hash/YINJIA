import java.sql.*;

/** 只读:确认 yj_panel/yj_field/yj_role_panel 上没有外键拦删除(影响删面板元数据的顺序)。 */
public class FkChk {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10",
                "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement s = c.createStatement()) {
            ResultSet r = s.executeQuery("SELECT COUNT(*) FROM sys.foreign_keys");
            r.next();
            System.out.println("库内全部外键数 = " + r.getInt(1));
            r = s.executeQuery("SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS 子表, OBJECT_NAME(fk.referenced_object_id) AS 父表"
                    + " FROM sys.foreign_keys fk");
            while (r.next()) System.out.println("  " + r.getString(1) + " : " + r.getString(2) + " -> " + r.getString(3));
            r = s.executeQuery("SELECT COUNT(*) FROM sys.objects WHERE type = 'F'");
            r.next();
            System.out.println("sys.objects type=F 计数 = " + r.getInt(1));
        }
    }
}
