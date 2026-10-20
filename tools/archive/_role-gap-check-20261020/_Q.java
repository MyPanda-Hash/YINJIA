import java.sql.*;

/** 合并后核查:migrate-role-panel-gap-20261020.sql 在测试账套自检失败(期望 8 行实际 14)。
 *  用法(在 tools 目录下):
 *    java -cp lib\mssql-jdbc.jar archive\_role-gap-check-20261020\_Q.java HSDZ_MES
 *    java -cp lib\mssql-jdbc.jar archive\_role-gap-check-20261020\_Q.java HSDZ_MES_TEST
 */
public class _Q {
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, USER, PASS)) {
            System.out.println("== " + db + " ==");
            dump(c, "SELECT COLUMN_NAME + ':' + DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                    + "WHERE TABLE_NAME = 'yj_role' ORDER BY ORDINAL_POSITION", "yj_role 列");
            dump(c, "SELECT * FROM yj_role ORDER BY 1", "yj_role");
            dump(c, "SELECT role_id, COUNT(1) AS cnt FROM yj_role_panel "
                    + "WHERE panel_code IN (N'PU_ORDER_DETAIL', N'PU_ORDER_STATS') "
                    + "GROUP BY role_id ORDER BY role_id", "采购两报表授权行/角色");
            dump(c, "SELECT role_id, COUNT(1) AS cnt FROM yj_role_panel "
                    + "WHERE panel_code = N'PU_ORDER' GROUP BY role_id ORDER BY role_id", "PU_ORDER 授权行/角色");
            dump(c, "SELECT DISTINCT role_id FROM yj_role_panel ORDER BY role_id", "授权表出现过的 role_id");
        }
    }

    static void dump(Connection c, String sql, String title) throws SQLException {
        System.out.println("-- " + title);
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(sql)) {
            int n = rs.getMetaData().getColumnCount();
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("   ");
                for (int i = 1; i <= n; i++) sb.append(rs.getObject(i)).append(i < n ? " | " : "");
                System.out.println(sb);
            }
        }
    }
}
