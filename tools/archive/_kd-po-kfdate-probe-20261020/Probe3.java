// Probe3.java — 只读:采购订单同步痕迹 + 面板字段可见性(确认「生产日期」在 MES 侧有没有位置)
import java.sql.*;

public class Probe3 {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static void q(Connection c, String title, String sql) {
        System.out.println("\n---- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            int n = 0;
            while (rs.next() && n++ < 80) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(i > 1 ? " | " : "").append(v == null ? "<null>" : v);
                }
                System.out.println("  " + row);
            }
            if (n == 0) System.out.println("  (no rows)");
        } catch (Exception e) {
            System.out.println("  ERR: " + e.getMessage());
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("DB=" + DB);
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            q(c, "A 采购订单同步痕迹(asp_user1 分布 / 最近写入时间)",
                "SELECT ISNULL(asp_user1,N'(空)') AS 落库人, COUNT(*) AS 单数, "
              + "       CONVERT(varchar(19), MAX(asp_time1), 120) AS 最近写入 "
              + "FROM bd_pu_order GROUP BY asp_user1 ORDER BY COUNT(*) DESC");

            q(c, "B 采购订单明细行落库人分布",
                "SELECT ISNULL(asp_user1,N'(空)') AS 落库人, COUNT(*) AS 行数, "
              + "       CONVERT(varchar(19), MAX(asp_time1), 120) AS 最近写入 "
              + "FROM bl_pu_order GROUP BY asp_user1 ORDER BY COUNT(*) DESC");

            q(c, "C 商品是否开启批次 列的取值分布(该列由 autoExtraLines 写入,用来判断附加列到底写没写)",
                "SELECT ISNULL(商品是否开启批次,N'<null>') AS 取值, COUNT(*) AS 行数 "
              + "FROM bl_pu_order GROUP BY 商品是否开启批次 ORDER BY COUNT(*) DESC");

            q(c, "D 采购订单面板 detail 位字段(界面列),按 seq",
                "SELECT seq, col_name, label, data_type, visible, hidden, editable "
              + "FROM yj_field WHERE panel_code=N'PU_ORDER' AND place LIKE N'%detail%' ORDER BY seq");

            q(c, "E 面板里有没有任何叫「生产日期」的字段",
                "SELECT panel_code, col_name, label, place, visible, hidden FROM yj_field "
              + "WHERE col_name=N'生产日期' OR label=N'生产日期' ORDER BY panel_code");
        }
    }
}
