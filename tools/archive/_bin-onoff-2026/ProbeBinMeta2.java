import java.sql.*;

/** 只读：补仓位列前的最后核对（4 张隐藏面板的「仓库」字段 label/col、seq 占用、明细键）。 */
public class ProbeBinMeta2 {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026")); Statement st = c.createStatement()) {
            System.out.println("=== " + db + " ===");
            System.out.println("\n① 4 张单 + 3 张补列单的「仓库」字段");
            try (ResultSet rs = st.executeQuery("SELECT panel_code,label,col_name,place,seq,hidden,visible,ref_panel,ref_field "
                    + "FROM yj_field WHERE place='detail' AND label=N'仓库' AND panel_code IN "
                    + "('MATERIAL_OUT','SALE_OUT','SALE_IN','MATERIAL_RET','FINISH_IN','OTHER_IN','OTHER_OUT') ORDER BY panel_code")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + "→" + rs.getString(3)
                        + " | seq=" + rs.getInt(5) + " hidden=" + rs.getInt(6) + " visible=" + rs.getInt(7)
                        + " ref=" + rs.getString(8) + "." + rs.getString(9));
            }
            System.out.println("\n② 7 张单 detail seq 占用（挑空位用）");
            try (ResultSet rs = st.executeQuery("SELECT panel_code, COUNT(*) n, MIN(seq) mn, MAX(seq) mx FROM yj_field "
                    + "WHERE place='detail' AND panel_code IN ('MATERIAL_OUT','SALE_OUT','SALE_IN','MATERIAL_RET','FINISH_IN','OTHER_IN','OTHER_OUT') "
                    + "GROUP BY panel_code ORDER BY panel_code")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " n=" + rs.getInt(2) + " seq " + rs.getInt(3) + "~" + rs.getInt(4));
            }
            System.out.println("\n③ 采购入库「仓位」的参照配置（照抄模板）");
            try (ResultSet rs = st.executeQuery("SELECT label,col_name,data_type,ref_panel,ref_field,display_field,ref_filter,width,seq,editable,required,hidden,visible,label_en "
                    + "FROM yj_field WHERE panel_code='PURCHASE_IN' AND label=N'仓位' AND place='detail'")) {
                while (rs.next()) {
                    StringBuilder sb = new StringBuilder("  ");
                    for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) sb.append(rs.getString(i)).append(" | ");
                    System.out.println(sb);
                }
            }
            System.out.println("\n④ 三张待补列的行表现有「仓库」列");
            for (String t : new String[]{"bl_finish_in", "bl_other_in", "bl_other_out"}) {
                StringBuilder sb = new StringBuilder();
                try (ResultSet rs = st.executeQuery("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='" + t
                        + "' AND (COLUMN_NAME LIKE N'%仓库%' OR COLUMN_NAME LIKE N'%仓%') ORDER BY ORDINAL_POSITION")) {
                    while (rs.next()) sb.append(rs.getString(1)).append(" ");
                }
                System.out.println("  " + t + ": " + sb);
            }
            System.out.println("\n⑤ yj_translation 里 仓位/仓位名称 现有译名");
            try (ResultSet rs = st.executeQuery("SELECT scope,ref_key,locale,text FROM yj_translation WHERE ref_key IN (N'仓位',N'仓位名称',N'仓位编码') ORDER BY ref_key,locale")) {
                while (rs.next()) System.out.println("  " + rs.getString(1) + " | " + rs.getString(2) + " | " + rs.getString(3) + " | " + rs.getString(4));
            }
        }
    }
}
