import java.sql.*;

/** 只读：为「补仓位列/字段」定位元数据（采购入库 仓位 的参照与级联配置、各面板 detail seq 占用）。 */
public class ProbeBinMeta {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass); Statement st = c.createStatement()) {
            System.out.println("=== DB=" + db + " ===");
            System.out.println("\n① PURCHASE_IN / MATERIAL_OUT / SALE_OUT 明细仓位字段的完整配置");
            try (ResultSet rs = st.executeQuery("SELECT panel_code,label,col_name,data_type,place,seq,width,editable,required,hidden,visible,"
                    + " ref_panel,ref_field,display_field,ref_filter,alias,col_group,tab_key FROM yj_field "
                    + "WHERE panel_code IN ('PURCHASE_IN','MATERIAL_OUT','SALE_OUT','SALE_IN','MATERIAL_RET','FINISH_IN','OTHER_IN','OTHER_OUT') "
                    + "AND (label LIKE N'%仓位%' OR col_name LIKE N'%仓位%') ORDER BY panel_code, place, seq")) {
                while (rs.next()) {
                    StringBuilder sb = new StringBuilder("  ");
                    for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) sb.append(rs.getString(i)).append(" | ");
                    System.out.println(sb);
                }
            }
            System.out.println("\n② 各面板 detail 字段数 / 最大 seq");
            try (ResultSet rs = st.executeQuery("SELECT panel_code, COUNT(*) n, MAX(seq) mx FROM yj_field WHERE place='detail' "
                    + "AND panel_code IN ('FINISH_IN','OTHER_IN','OTHER_OUT','QC_RETURN') GROUP BY panel_code")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " n=" + rs.getInt(2) + " maxSeq=" + rs.getInt(3));
            }
            System.out.println("\n③ FINISH_IN / OTHER_IN / OTHER_OUT / QC_RETURN 明细表与现有列数");
            String[][] t = {{"FINISH_IN", "bl_finish_in"}, {"OTHER_IN", "bl_other_in"}, {"OTHER_OUT", "bl_other_out"}, {"QC_RETURN", "qc_return_detail"}};
            for (String[] x : t) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + x[1] + "'")) {
                    if (rs.next()) System.out.println("  " + x[0] + " / " + x[1] + " 列数=" + rs.getInt(1));
                }
                try (ResultSet rs = st.executeQuery("SELECT TOP 3 COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + x[1] + "' ORDER BY ORDINAL_POSITION DESC")) {
                    StringBuilder sb = new StringBuilder();
                    while (rs.next()) sb.append(rs.getString(1)).append(" ");
                    System.out.println("     末 3 列: " + sb);
                }
            }
            System.out.println("\n④ 字段译名「仓位」是否已在 yj_translation");
            try (ResultSet rs = st.executeQuery("SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'仓位', N'仓位编码') AND locale IN ('en','ja')")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3) + " | " + rs.getString(4));
            }
            System.out.println("\n⑤ 面板 mode / 明细键（确认 archive/sheet 形态）");
            try (ResultSet rs = st.executeQuery("SELECT panel_code, panel_name, category, mode, line_table, detail_key FROM yj_panel WHERE panel_code IN ('FINISH_IN','OTHER_IN','OTHER_OUT','PURCHASE_IN')")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3) + " | " + rs.getString(4) + " | " + rs.getString(5) + " | " + rs.getString(6));
            }
        }
    }
}
