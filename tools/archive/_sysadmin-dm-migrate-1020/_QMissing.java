import java.sql.*;

/**
 * _QMissing.java — 找出 migrate-proc-process-refs 白名单里「哪张面板 / 哪个字段」在库里不存在。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_sysadmin-dm-migrate-1020\_QMissing.java HSDZ_MES
 */
public class _QMissing {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String[] panels = { "DAY_REPORT", "FEED_CONFIRM", "MIX_RECORD", "GRAN_RECORD", "WH_RECORD",
                    "PACK_CONFIRM", "PROD_ABN", "WO_REPORT", "WO_REPORT_LIST", "WO_COMPLETION_LIST" };
            System.out.println("===== " + db + " 目标面板存在性 =====");
            for (String p : panels) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT p.panel_name, (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code=p.panel_code) "
                                + "FROM yj_panel p WHERE p.panel_code=?")) {
                    ps.setString(1, p);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) System.out.println(String.format("  %-20s 存在  面板名=%-16s 字段=%d", p, rs.getString(1), rs.getInt(2)));
                        else System.out.println(String.format("  %-20s 【yj_panel 里不存在】", p));
                    }
                }
            }
            System.out.println("--- 名字相近的(找是不是改过名) ---");
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT panel_code, panel_name FROM yj_panel WHERE panel_code LIKE ? OR panel_code LIKE ? OR panel_code LIKE ?")) {
                ps.setString(1, "%COMPLETION%"); ps.setString(2, "%WO_%"); ps.setString(3, "%REPORT%");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println("  " + String.format("%-24s %s", rs.getString(1), rs.getString(2)));
                }
            }
        }
    }
}
