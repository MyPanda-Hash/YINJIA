import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * ResetWoBoardColumnSettings.java — 一次性取证/清理脚本(2026-11-18)
 *
 * 背景:为「工单排产」加列设置时,用 ego 浏览器把界面上「隐藏列 + 调整顺序 + 恢复默认」走了一遍,
 * 这一步会把偏好写进 `report_column_settings`(panel_code='WORK_ORDER_BOARD')。该表按面板存一行、
 * **全用户共享**;本页此前从没有过这份设置,收尾时把它删掉,让正式账套回到「没配置过 = 默认全列」的原状。
 *
 * 用法(在 tools 目录下):
 *   java -Dstdout.encoding=UTF-8 -cp lib/mssql-jdbc.jar archive\_wo-board-columns-20261118\ResetWoBoardColumnSettings.java [--delete]
 * 不传 --delete 只打印现状(默认只读);传了才删 WORK_ORDER_BOARD 那一行。
 * 连接参数与 tools/DbSync.java 同一套:库名 YINJIA_SQL_DB(默认 HSDZ_MES)、密码 YINJIA_SQL_PASS。
 */
public class ResetWoBoardColumnSettings {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true";
    static final String USER = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String PANEL = "WORK_ORDER_BOARD";

    public static void main(String[] args) throws Exception {
        boolean del = args.length > 0 && "--delete".equalsIgnoreCase(args[0]);
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("[db] " + DB + " as " + USER);
            try (Statement st = c.createStatement()) {
                try (ResultSet rs = st.executeQuery(
                        "SELECT panel_code, update_by, update_time, LEN(settings) FROM report_column_settings WHERE panel_code = '" + PANEL + "'")) {
                    boolean any = false;
                    while (rs.next()) {
                        any = true;
                        System.out.println("[row] " + rs.getString(1) + " by=" + rs.getString(2)
                                + " at=" + rs.getString(3) + " jsonLen=" + rs.getInt(4));
                    }
                    if (!any) System.out.println("[row] 无 " + PANEL + " 设置(已是默认全列)");
                }
                if (del) {
                    int n = st.executeUpdate("DELETE FROM report_column_settings WHERE panel_code = '" + PANEL + "'");
                    System.out.println("[delete] " + n + " 行");
                }
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM report_column_settings")) {
                    if (rs.next()) System.out.println("[total] report_column_settings 共 " + rs.getInt(1) + " 行");
                }
            }
        }
    }
}
