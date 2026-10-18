import java.sql.*;

/**
 * _QGroup.java — 查 yj_panel 的 module_group 分布 + 数据建模/系统管理平台 的逐张清单。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QGroup.java HSDZ_MES
 */
public class _QGroup {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {

            System.out.println("===== " + db + " =====");
            System.out.println("--- 1) module_group 分布 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT ISNULL(module_group,N'(NULL)') g, COUNT(*) n FROM yj_panel GROUP BY module_group ORDER BY n DESC")) {
                while (rs.next()) System.out.println(String.format("  %-24s %d", rs.getString(1), rs.getInt(2)));
            }

            System.out.println("--- 2) 数据建模 面板清单 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, panel_name, category FROM yj_panel WHERE module_group = N'数据建模' ORDER BY panel_code")) {
                int i = 0;
                while (rs.next()) System.out.println(String.format("  %2d %-22s %-20s %s", ++i, rs.getString(1), rs.getString(2), rs.getString(3)));
            }

            System.out.println("--- 3) 系统管理平台 残留 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, panel_name FROM yj_panel WHERE module_group = N'系统管理平台'")) {
                int n = 0;
                while (rs.next()) { n++; System.out.println("  " + rs.getString(1) + " " + rs.getString(2)); }
                if (n == 0) System.out.println("  (0 张)");
            }

            System.out.println("--- 4) 既有 4 张是否仍在数据建模 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, ISNULL(module_group,N'(NULL)') FROM yj_panel WHERE panel_code IN (N'FIELDMGR',N'ZDGL',N'ERPLG',N'ERPLG_ROW')")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " -> " + rs.getString(2));
            }

            System.out.println("--- 5) 迁移来源候选:category 属于 基础数据/物料及价格/生产/财务 的面板 ---");
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                    "SELECT panel_code, panel_name, category, ISNULL(module_group,N'(NULL)') g FROM yj_panel "
                            + "WHERE category IN (N'基础数据',N'物料及价格',N'生产',N'财务') ORDER BY category, panel_code")) {
                int n = 0;
                while (rs.next()) { n++; System.out.println(String.format("  %-22s %-18s %-10s -> %s", rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4))); }
                System.out.println("  小计 " + n);
            }
        }
    }
}
