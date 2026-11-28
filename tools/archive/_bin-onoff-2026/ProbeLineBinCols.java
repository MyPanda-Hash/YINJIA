import java.sql.*;

/** 只读：转ERP 十张单的明细表里，仓位相关列到底有没有（列名/类型/现有填写行数）。 */
public class ProbeLineBinCols {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String[][] panels = {
                {"PURCHASE_IN", "bl_purchase_in"}, {"SALE_OUT", "bl_sale_out"}, {"MATERIAL_OUT", "bl_material_out"},
                {"FINISH_IN", "bl_finish_in"}, {"OTHER_IN", "bl_other_in"}, {"OTHER_OUT", "bl_other_out"},
                {"QC_RETURN", "bl_qc_return"}, {"SALE_IN", "bl_sale_in"}, {"MATERIAL_RET", "bl_material_ret"},
                {"PU_ORDER", "bl_pu_order"}};
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("=== DB=" + db + " ===");
            for (String[] p : panels) {
                String t = p[1];
                StringBuilder cols = new StringBuilder();
                try (PreparedStatement ps = c.prepareStatement(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND (COLUMN_NAME LIKE N'%仓位%') ORDER BY ORDINAL_POSITION")) {
                    ps.setString(1, t);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) cols.append(rs.getString(1)).append(" ");
                    }
                }
                System.out.println(p[0] + " / " + t + " 仓位列: " + (cols.length() == 0 ? "(无)" : cols));
                // 填写情况
                for (String col : new String[]{"仓位编码"}) {
                    try (Statement st = c.createStatement();
                         ResultSet rs = st.executeQuery("SELECT COUNT(*) n, SUM(CASE WHEN ISNULL([" + col + "],N'')<>N'' THEN 1 ELSE 0 END) f FROM dbo." + t)) {
                        if (rs.next()) System.out.println("     " + col + ": 行=" + rs.getInt(1) + " 有值=" + rs.getInt(2));
                    } catch (Exception e) {
                        System.out.println("     " + col + ": 跳过(" + e.getMessage() + ")");
                    }
                }
            }
            // 物理列与 yj_field label 的对应（仓位 label 用的物理列）
            System.out.println("\n=== yj_field: 各面板 detail 的仓位字段 ===");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT panel_code, label, col_name, hidden, visible, ref_panel FROM yj_field "
                         + " WHERE place='detail' AND label LIKE N'%仓位%' ORDER BY panel_code")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " → " + rs.getString(3)
                        + " | hidden=" + rs.getString(4) + " visible=" + rs.getString(5) + " ref=" + rs.getString(6));
            }
        }
    }
}
