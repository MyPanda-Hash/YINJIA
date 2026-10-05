import java.sql.*;

/**
 * 只读核对:MES 侧「BOM / 工艺路线」相关面板与数据现状(回答"拉回来后落到哪个面板")。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/BomRoutePanels.java
 */
public class BomRoutePanels {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "BOM/工艺路线/工序 相关面板",
                    "SELECT panel_code, panel_name, mode, head_table, line_table, detail_key, module_group "
                            + "FROM yj_panel WHERE panel_code IN ('BOM','BOM_KD','ROUTE','OP','RD_ASM_BOM','WLBOM','TEAM','EQUIP') ORDER BY module_group, panel_code");
            q(c, "各承载表行数",
                    "SELECT 'bs_bom' AS 表, COUNT(*) AS 行数 FROM bs_bom "
                            + "UNION ALL SELECT 'bs_bom_head', COUNT(*) FROM bs_bom_head "
                            + "UNION ALL SELECT 'bs_bom_detail', COUNT(*) FROM bs_bom_detail "
                            + "UNION ALL SELECT 'bs_route', COUNT(*) FROM bs_route "
                            + "UNION ALL SELECT 'bs_op', COUNT(*) FROM bs_op "
                            + "UNION ALL SELECT 'rd_asm_bom_head', COUNT(*) FROM rd_asm_bom_head "
                            + "UNION ALL SELECT 'rd_asm_bom_detail', COUNT(*) FROM rd_asm_bom_detail");
            q(c, "BOM 面板字段数(元数据)",
                    "SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code IN ('BOM','BOM_KD','ROUTE') GROUP BY panel_code");
            q(c, "有外部数据ID的商品数(金蝶已同步的商品)",
                    "SELECT COUNT(*) AS 商品总数, SUM(CASE WHEN ISNULL(外部数据ID,'')<>'' THEN 1 ELSE 0 END) AS 有外部ID FROM bs_inv");
            q(c, "截图里的产品 A-32-01 在 MES 商品档案里吗",
                    "SELECT 存货编码, 存货名称, 规格型号, 外部数据ID FROM bs_inv WHERE 存货编码 = N'A-32-01'");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n== " + title + " ==");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(h);
            int n = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(rs.getString(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(sb);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
