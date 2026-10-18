import java.sql.*;
import java.util.*;

/**
 * _QLog.java — yj_schema_log 口径:这个脚本登记过没有、链上排在它后面的脚本执行了没有。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QLog.java HSDZ_MES
 */
public class _QLog {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {

            System.out.println("===== " + db + " yj_schema_log =====");
            System.out.println("--- 列结构 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT c.name, t.name AS ty FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id "
                            + "WHERE c.object_id=OBJECT_ID(N'dbo.yj_schema_log') ORDER BY c.column_id")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " : " + rs.getString(2));
            }

            System.out.println("--- 目标脚本登记情况 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT * FROM yj_schema_log WHERE script_name LIKE N'%sysadmin-panels-to-dm%'")) {
                ResultSetMetaData md = rs.getMetaData();
                int n = 0;
                while (rs.next()) {
                    n++;
                    StringBuilder sb = new StringBuilder("  ");
                    for (int i = 1; i <= md.getColumnCount(); i++) {
                        String v = rs.getString(i);
                        if (v != null && v.length() > 24) v = v.substring(0, 24) + "…";
                        sb.append(md.getColumnName(i)).append('=').append(v).append("  ");
                    }
                    System.out.println(sb);
                }
                if (n == 0) System.out.println("  (未登记!)");
            }

            System.out.println("--- 登记总数 / 最近 12 条 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_schema_log")) {
                rs.next();
                System.out.println("  总登记 " + rs.getInt(1) + " 条");
            }

            System.out.println("--- 20261018 之后登记的脚本(看链尾有没有断) ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT TOP 40 script_name, applied_at FROM yj_schema_log ORDER BY applied_at DESC")) {
                while (rs.next()) System.out.println("  " + rs.getString(2) + "  " + rs.getString(1));
            }
        }
    }
}
