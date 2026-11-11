import java.sql.*;

public class _Probe {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "A. RD_MOLD_PROC 密度/配料 字段元数据",
              "SELECT label, data_type, dict_sql, place, seq, required, visible, hidden, ref_panel FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND label IN (N'密度管控要求',N'实际密度管控下限',N'实际密度管控上限',N'配料要求',N'灌料要求',N'热压要求') ORDER BY seq");
            q(c, "B. PROD_MOLD 面板是否存在 + 角色权限",
              "SELECT r.id, r.role_name, p.perm FROM yj_role_panel p JOIN yj_role r ON r.id=p.role_id WHERE p.panel_code='PROD_MOLD' ORDER BY r.id");
            q(c, "C. RD_MOLD_PROC 角色权限",
              "SELECT r.id, r.role_name, p.perm FROM yj_role_panel p JOIN yj_role r ON r.id=p.role_id WHERE p.panel_code='RD_MOLD_PROC' ORDER BY r.id");
            q(c, "D. 配方表 detail 字段(RD_MOLD_PROC)",
              "SELECT label, data_type, place, seq, visible, hidden FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND place LIKE '%detail%' ORDER BY seq");
            q(c, "E. RD_X_SINTER 配方表字段",
              "SELECT label, data_type, place, seq, visible, hidden FROM yj_field WHERE panel_code='RD_X_SINTER' AND place LIKE '%detail%' ORDER BY seq");
        }
    }
    static void q(Connection c, String title, String sql) throws Exception {
        System.out.println("== " + title + " ==");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(h);
            int n = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) b.append(rs.getString(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(b);
                n++;
            }
            System.out.println("(" + n + " rows)");
        }
    }
}
