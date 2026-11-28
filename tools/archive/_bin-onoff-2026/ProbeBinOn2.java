import java.sql.*;

/**
 * 一次性只读取证（第 2 版）：正式账套「仓库 / 仓位」使用实况。
 * 只跑 SELECT。
 */
public class ProbeBinOn2 {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("=== DB=" + db + " ===");
            try (Statement st = c.createStatement()) {
                q(st, "① kucun 现存按仓库分布（前 15）",
                        "SELECT TOP 15 RTRIM(ISNULL(ckdm,N'')) AS 仓库编码, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 数量合计"
                      + " FROM dbo.kucun GROUP BY ckdm ORDER BY COUNT(*) DESC");

                q(st, "② 采购入库行 按仓库（近两年）",
                        "SELECT TOP 15 RTRIM(ISNULL([仓库编码],N'')) AS 仓库编码, RTRIM(ISNULL([仓库名称],N'')) AS 仓库名称,"
                      + "  COUNT(*) AS 行数, MAX([单据编号]) AS 最新单号 FROM dbo.bl_purchase_in GROUP BY [仓库编码],[仓库名称] ORDER BY COUNT(*) DESC");

                q(st, "③ 销售出库行 按仓库",
                        "SELECT TOP 10 RTRIM(ISNULL([仓库编码],N'')) AS 仓库编码, COUNT(*) AS 行数 FROM dbo.bl_sale_out GROUP BY [仓库编码] ORDER BY COUNT(*) DESC");

                q(st, "④ 材料出库行 按仓库",
                        "SELECT TOP 10 RTRIM(ISNULL([仓库编码],N'')) AS 仓库编码, COUNT(*) AS 行数 FROM dbo.bl_material_out GROUP BY [仓库编码] ORDER BY COUNT(*) DESC");

                q(st, "⑤ 调拨单行 的仓库/仓位",
                        "SELECT TOP 20 [单据编号],[调出仓库],[调出仓库编码],[调入仓库],[调入仓库编码],[调出仓位编码],[调入仓位编码] FROM dbo.bl_transfer ORDER BY asp_time1 DESC");

                q(st, "⑥ bs_wh_loc 结构（仓位档案列）",
                        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_wh_loc' ORDER BY ORDINAL_POSITION");

                q(st, "⑦ 各仓「是否默认」仓位情况",
                        "SELECT RTRIM(ISNULL([仓库编码],N'')) AS 仓库编码, RTRIM(ISNULL([仓库],N'')) AS 仓库名称, COUNT(*) AS 仓位数,"
                      + "  SUM(CASE WHEN ISNULL([是否默认],0)=1 THEN 1 ELSE 0 END) AS 默认标记数"
                      + " FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [仓库编码],[仓库] ORDER BY COUNT(*) DESC");

                q(st, "⑧ yj_panel 里 WHLOC / WH 登记",
                        "SELECT panel_code, panel_name, category, mode, line_table FROM dbo.yj_panel WHERE panel_code IN ('WH','WHLOC')");

                q(st, "⑨ WH 面板全部字段（看「启用仓位管理」在界面哪一列）",
                        "SELECT label, col_name, data_type, place, seq, hidden, visible, required FROM dbo.yj_field WHERE panel_code='WH' ORDER BY place, seq");

                q(st, "⑩ WHLOC 面板全部字段",
                        "SELECT label, col_name, data_type, place, seq, hidden, visible, ref_panel, ref_field FROM dbo.yj_field WHERE panel_code='WHLOC' ORDER BY place, seq");

                q(st, "⑪ 采购入库/来料检验/暂收 的仓位字段可见性",
                        "SELECT panel_code, label, col_name, place, seq, hidden, visible, ref_panel, ref_field"
                      + " FROM dbo.yj_field WHERE panel_code IN ('PURCHASE_IN','QC_INSP','QC_RECV','TRANSFER','STOCKTAKE') AND label LIKE N'%仓位%'"
                      + " ORDER BY panel_code, place, seq");

                q(st, "⑫ 库里还有哪些「仓位」口径的档案/权限痕迹（菜单只在代码）",
                        "SELECT COUNT(*) AS WHLOC字段数 FROM dbo.yj_field WHERE panel_code='WHLOC'");
            }
        }
    }

    static void q(Statement st, String title, String sql) {
        System.out.println("\n" + title);
        try (ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder head = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) head.append(m.getColumnLabel(i)).append(" | ");
            System.out.println(head);
            while (rs.next()) {
                StringBuilder sb = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) sb.append(rs.getString(i)).append(" | ");
                System.out.println(sb);
            }
        } catch (Exception e) {
            System.out.println("  -> 失败: " + e.getMessage());
        }
    }
}
