import java.sql.*;

/**
 * 一次性只读取证：正式/测试账套到底有没有"用仓位"。
 * 只跑 SELECT，不写库。
 * 用法：java -cp lib/mssql-jdbc.jar archive/_bin-onoff-2026/ProbeBinOn.java HSDZ_MES
 */
public class ProbeBinOn {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("=== DB=" + db + " ===");
            try (Statement st = c.createStatement()) {
                // ① 仓库档案：启用仓位管理
                q(st, "① 仓库档案 bs_wh（启用仓位管理 / 停用 / 仓位档案条数）",
                        "SELECT RTRIM(w.[仓库编码]) AS 仓库编码, RTRIM(w.[仓库名称]) AS 仓库名称,"
                      + "  ISNULL(CONVERT(nvarchar(4), w.[启用仓位管理]), N'(NULL)') AS 启用仓位管理,"
                      + "  ISNULL(CONVERT(nvarchar(10), w.[停用]), N'(NULL)') AS 停用,"
                      + "  (SELECT COUNT(*) FROM dbo.bs_wh_loc l WHERE l.[仓库编码]=w.[仓库编码] AND ISNULL(l.asp_cancel,'N')<>'Y') AS 仓位档案数,"
                      + "  (SELECT COUNT(*) FROM dbo.bs_wh_loc l WHERE l.[仓库编码]=w.[仓库编码] AND ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(l.[停用],0)=0) AS 有效仓位"
                      + " FROM dbo.bs_wh w WHERE ISNULL(w.asp_cancel,'N')<>'Y' ORDER BY w.[仓库编码]");

                // ② 仓位档案总量
                one(st, "② bs_wh_loc 总行数(全)", "SELECT COUNT(*) FROM dbo.bs_wh_loc");
                one(st, "② bs_wh_loc 存活行数", "SELECT COUNT(*) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'");
                one(st, "② bs_wh_loc 不同仓位编码数", "SELECT COUNT(DISTINCT RTRIM([仓位编码])) FROM dbo.bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'");

                // ③ 仓库档案层面：启用仓位管理=1 的仓有几个
                one(st, "③ 启用仓位管理=1 的仓数", "SELECT COUNT(*) FROM dbo.bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([启用仓位管理],0)=1");

                // ④ 各单据行 仓位填了多少
                doc(st, "bl_purchase_in", "仓位编码");
                doc(st, "bl_sale_out", "仓位编码");
                doc(st, "bl_material_out", "仓位编码");
                doc(st, "bl_pu_order", "仓位编码");
                doc(st, "bl_so_order", "仓位编码");
                doc(st, "bl_transfer", "调出仓位编码");
                doc(st, "bl_stocktake", "仓位编码");

                // ⑤ 物料档案默认仓位
                one(st, "⑤ bs_inv.默认仓位 有值行数", "SELECT COUNT(*) FROM dbo.bs_inv WHERE ISNULL([默认仓位],N'')<>N''");
                one(st, "⑤ bs_inv 总行数", "SELECT COUNT(*) FROM dbo.bs_inv");

                // ⑥ 元数据：哪些面板登记了「仓位」字段 / 参照 WHLOC
                q(st, "⑥ yj_field 里的仓位字段（面板 / label / 物理列 / 参照 / 可见）",
                        "SELECT panel_code, label, col_name, ISNULL(ref_panel,N'') AS ref_panel,"
                      + "  ISNULL(ref_field,N'') AS ref_field, place, seq, hidden, visible"
                      + " FROM dbo.yj_field WHERE label LIKE N'%仓位%' ORDER BY panel_code, place, seq");

                // ⑦ WHLOC 面板登记
                q(st, "⑦ WHLOC 面板登记", "SELECT code, name, category, mode, line_table FROM dbo.yj_panel WHERE code='WHLOC'");
                q(st, "⑦ WH 面板的 启用仓位管理 字段", "SELECT panel_code, label, col_name, data_type, place, seq, hidden, visible FROM dbo.yj_field WHERE panel_code='WH' AND label LIKE N'%仓位%'");

                // ⑧ kucun/流水有没有仓位维度
                q(st, "⑧ kucun 列里带「仓位」的", "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='kucun' AND COLUMN_NAME LIKE N'%仓位%'");
                q(st, "⑧ inh/outh 列里带「仓位」的", "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('inh','outh') AND COLUMN_NAME LIKE N'%仓位%'");
            }
        }
    }

    static void doc(Statement st, String table, String col) {
        String sql = "SELECT COUNT(*) AS 总行, SUM(CASE WHEN ISNULL(" + col + ",N'')<>N'' THEN 1 ELSE 0 END) AS 有仓位 FROM dbo." + table;
        try {
            one(st, "④ " + table + "." + col + " 填写情况", sql);
        } catch (Exception e) {
            System.out.println("④ " + table + " -> 跳过(" + e.getMessage() + ")");
        }
    }

    static void one(Statement st, String title, String sql) {
        try (ResultSet rs = st.executeQuery(sql)) {
            StringBuilder sb = new StringBuilder("  " + title + " : ");
            ResultSetMetaData m = rs.getMetaData();
            while (rs.next()) {
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(rs.getString(i)).append("  ");
            }
            System.out.println(sb);
        } catch (Exception e) {
            System.out.println("  " + title + " -> 失败: " + e.getMessage());
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
