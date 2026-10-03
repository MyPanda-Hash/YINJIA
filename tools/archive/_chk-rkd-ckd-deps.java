import java.sql.*;

/**
 * 只读排查:删 RKD/CKD 面板元数据前的依赖盘点 ——
 * ① yj_panel 上的外键(决定删除顺序);② 引用 RKD/CKD 的所有元数据表;③ 列清单。
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive/_chk-rkd-ckd-deps.java
 */
public class RkdCkdDeps {
    static String url() {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        return "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    }

    static void q(Connection c, String title, String sql) {
        System.out.println("---- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next() && n++ < 40) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
                    row.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println("  " + row);
            }
            if (n == 0) System.out.println("  (no rows)");
        } catch (Exception e) { System.out.println("  ERR: " + e.getMessage()); }
    }

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(url(), "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("connected: " + c.getCatalog());
            q(c, "yj_panel / yj_field / yj_role_panel 上的外键",
                    "SELECT OBJECT_NAME(fk.parent_object_id) AS 子表, fk.name, OBJECT_NAME(fk.referenced_object_id) AS 父表,"
                            + " fk.delete_referential_action_desc AS 级联删除"
                            + " FROM sys.foreign_keys fk WHERE OBJECT_NAME(fk.referenced_object_id) IN ('yj_panel','yj_field')"
                            + "    OR OBJECT_NAME(fk.parent_object_id) IN ('yj_panel','yj_field','yj_role_panel')");
            q(c, "引用 RKD/CKD 的元数据表(逐表)",
                    "SELECT 'yj_panel' AS t, COUNT(*) AS n FROM yj_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_field', COUNT(*) FROM yj_field WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_role_panel', COUNT(*) FROM yj_role_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_translation(panel 入库单/出库单)', COUNT(*) FROM yj_translation"
                            + "     WHERE scope='panel' AND ref_key IN (N'入库单',N'出库单')");
            q(c, "yj_doc_status RKD/CKD 行(看是不是真实业务痕迹)",
                    "SELECT panel_code, doc_no, 单据状态, 审核人, 审核时间 FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')");
            q(c, "yj_doc_status 列", "SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_doc_status') ORDER BY column_id");
            q(c, "yj_role_panel 引用 RKD/CKD 的角色", "SELECT * FROM yj_role_panel WHERE panel_code IN ('RKD','CKD')");
            q(c, "两个面板当前行", "SELECT panel_code, panel_name, line_table, head_table, pk_col, module_group FROM yj_panel WHERE panel_code IN ('RKD','CKD')");
            q(c, "备份表白名单现状", "SELECT COUNT(*) AS n FROM sys.tables WHERE name IN ('inh_bak_20260930','outh_bak_20260930')");
        }
    }
}
