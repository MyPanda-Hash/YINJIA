import java.sql.*;

/**
 * 只读探针:转ERP「是否已转ERP」标记在各单据头上的实际落值与类型。
 * 目的:确认已转单据点「转ERP」时,KingdeePushService 的「已转」守卫(`"是".equals(...)`)能不能命中,
 *       即"已转还能再转、还提示成功"到底是后端守卫没命中,还是前端忽略了后端返回的 message。
 * 用法(在 tools 目录下):java -cp lib\mssql-jdbc.jar archive\_erp-already-prompt-20261109\ErpFlagProbe.java [库名]
 */
public class ErpFlagProbe {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String[][] tables = {
                {"PURCHASE_IN", "bd_purchase_in"}, {"SALE_OUT", "bd_sale_out"},
                {"PU_ORDER", "bd_pu_order"}, {"MATERIAL_OUT", "bd_material_out"},
                {"FINISH_IN", "bd_finish_in"}, {"OTHER_IN", "bd_other_in"},
                {"OTHER_OUT", "bd_other_out"}, {"QC_RETURN", "qc_return"}
        };
        System.out.println("== DB " + db + " ==");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            for (String[] t : tables) {
                String panel = t[0], tbl = t[1];
                System.out.println("\n-- " + panel + " / " + tbl);
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT c.name, ty.name AS typ, c.max_length, c.is_nullable"
                                + " FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id"
                                + " WHERE c.object_id=OBJECT_ID(N'dbo." + tbl + "')"
                                + " AND c.name IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间')")) {
                    boolean any = false;
                    while (rs.next()) {
                        any = true;
                        System.out.println("   列 " + rs.getString(1) + " " + rs.getString(2)
                                + "(" + rs.getInt(3) + ") nullable=" + rs.getBoolean(4));
                    }
                    if (!any) System.out.println("   [!] 四列一个都不存在");
                } catch (Exception e) {
                    System.out.println("   [读列失败] " + e.getMessage());
                }
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT ISNULL(是否已转ERP, N'(null)') AS v, COUNT(*) AS n,"
                                + " SUM(CASE WHEN LEN(LTRIM(RTRIM(ISNULL(是否已转ERP, N'')))) <> LEN(ISNULL(是否已转ERP, N'')) THEN 1 ELSE 0 END) AS tailSpace"
                                + " FROM " + tbl + " GROUP BY ISNULL(是否已转ERP, N'(null)')")) {
                    while (rs.next()) {
                        System.out.println("   值 [" + rs.getString("v") + "] 行数=" + rs.getInt("n")
                                + " 带尾空格行数=" + rs.getInt("tailSpace"));
                    }
                } catch (Exception e) {
                    System.out.println("   [读值失败] " + e.getMessage());
                }
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT COUNT(*) AS n FROM " + tbl + " WHERE 是否已转ERP = N'是' AND ERP单号 IS NOT NULL")) {
                    if (rs.next()) System.out.println("   已转且有ERP单号 = " + rs.getInt(1));
                } catch (Exception ignored) {}
            }
        }
    }
}
