// _ProbeMeta.java — 一次性探针(2026-10-21):确认 SCHEDULE_BOARD 是**页面级虚拟面板**(无 yj_panel/yj_field 行),
// 所以本次加列只需改 Vue 模板 + 后端 SELECT,不需要任何库迁移/字段登记/译名插行。
import java.sql.*;

public class _ProbeMeta {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + (a.length > 0 ? a[0] : "HSDZ_MES") + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
             Statement st = c.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_panel WHERE panel_code=N'SCHEDULE_BOARD'")) {
                rs.next(); System.out.println("yj_panel 行数 = " + rs.getInt(1));
            }
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM yj_field WHERE panel_id=(SELECT id FROM yj_panel WHERE panel_code=N'SCHEDULE_BOARD')")) {
                rs.next(); System.out.println("yj_field 行数 = " + rs.getInt(1));
            }
            for (String k : new String[]{"产品编号", "品名", "型号"}) {
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT locale, text FROM yj_translation WHERE scope='field' AND ref_key=? ORDER BY locale")) {
                    ps.setString(1, k);
                    try (ResultSet rs = ps.executeQuery()) {
                        StringBuilder b = new StringBuilder();
                        while (rs.next()) b.append(rs.getString(1)).append('=').append(rs.getString(2)).append(' ');
                        System.out.println("译名[" + k + "] = " + b);
                    }
                }
            }
        }
    }
}
