import java.sql.*;

/** 只读:按关键字列面板编码/名称/模式(本次用于找新面板的路由码)。 */
public class FindPanel {
    public static void main(String[] a) throws Exception {
        String kw = a.length > 0 ? a[0] : "";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             PreparedStatement ps = c.prepareStatement(
                     "SELECT panel_code, panel_name, mode, line_table FROM yj_panel WHERE panel_name LIKE N'%' + ? + N'%' ORDER BY panel_code")) {
            ps.setString(1, kw);
            try (ResultSet r = ps.executeQuery()) {
                while (r.next()) {
                    System.out.printf("%-24s %-28s mode=%-8s line=%s%n",
                            r.getString(1), r.getString(2), r.getString(3), r.getString(4));
                }
            }
        }
    }
}
