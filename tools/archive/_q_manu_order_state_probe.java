/*
 * 只读探针(2026-10-16):核实 MANU_ORDER 旧面板在当前库是否还存在。
 *   ① yj_panel / yj_field 是否还有 MANU_ORDER 及其相关面板(及迁移脚本里提到的 MANU_SCHEDULE 等)
 *   ② 这些面板在菜单/权限(role_panel)是否还挂接
 *   ③ MANU_ORDER 指向的物理表 bd_manu_order / bl_manu_order 是否还有数据(残留)
 *   ④ 现状生产工单真身 plang 是否接管
 * 用法: cd tools && javac -d archive\classes archive\_q_manu_order_state_probe.java
 *       java -cp "lib\mssql-jdbc.jar;archive\classes" _q_manu_order_state_probe
 *   可加环境变量 YINJIA_SQL_DB=HSDZ_MES_TEST 切测试账套。
 */
import java.sql.*;

public class _q_manu_order_state_probe {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");

            p("\n### ① yj_panel 中遗留生产域面板是否还在 ###");
            q(c, "SELECT panel_code, panel_name, head_table, line_table, mode FROM yj_panel "
                    + "WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE',N'LINE_LOAD',N'LINE_CAP',N'WO_KIT',N'MANU_ORDER_DETAIL',N'MANU_ORDER_STATS') "
                    + "ORDER BY panel_code");
            p("\n### ①b 生产工单真身(对比) ###");
            q(c, "SELECT panel_code, panel_name, head_table, line_table, mode FROM yj_panel "
                    + "WHERE panel_code IN (N'WORK_ORDER_LIST',N'PLANG') OR panel_name LIKE N'%生产工单%' ORDER BY panel_code");

            p("\n### ② yj_field 是否还登记了 MANU_ORDER 字段 ###");
            q(c, "SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field "
                    + "WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE') GROUP BY panel_code ORDER BY panel_code");

            p("\n### ③ 权限(role_panel)是否还挂接这些旧面板 ###");
            q(c, "SELECT panel_code, COUNT(*) AS 授权角色数 FROM yj_role_panel "
                    + "WHERE panel_code IN (N'MANU_ORDER',N'MANU_SCHEDULE',N'WO_ORDER',N'WO_SCHEDULE') GROUP BY panel_code ORDER BY panel_code");

            p("\n### ④ 旧物理表 bd_manu_order / bl_manu_order 是否有残留数据 ###");
            q(c, "SELECT N'bd_manu_order' AS 表, COUNT(*) AS 行数 FROM bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y' "
                    + "UNION ALL SELECT N'bl_manu_order', COUNT(*) FROM bl_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y'");

            p("\n### ⑤ 当前生产工单真身 plang 数据量(对照) ###");
            q(c, "SELECT COUNT(*) AS plang行数 FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y'");

            p("\n### ⑥ PUSH_TARGETS/SELECT_FLOWS 残留影响的占用链:MANU_ORDER 通道占用是否还活着 ###");
            q(c, "SELECT link_status, COUNT(*) AS 条数 FROM form_flow_link WHERE target_panel_code='MANU_ORDER' GROUP BY link_status");
            q(c, "SELECT link_status, COUNT(*) AS 条数 FROM form_flow_link WHERE source_panel_code='MANU_ORDER' GROUP BY link_status");

            p("\n### ⑦ yj_panel 里是否仍有面板名含'加工单'(旧 MANU_ORDER 语义) ###");
            q(c, "SELECT panel_code, panel_name FROM yj_panel WHERE panel_name LIKE N'%加工单%' OR panel_name LIKE N'%生产加工%' ORDER BY panel_code");
        }
    }

    static void p(String s) { System.out.println(s); }
    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder("  ");
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder("  ");
                for (int i = 1; i <= n; i++) {
                    String v = rs.getString(i);
                    b.append(v == null ? "NULL" : v.trim()).append(i < n ? " | " : "");
                }
                System.out.println(b);
                rows++;
            }
            if (rows == 0) System.out.println("  (无行)");
        } catch (Exception e) {
            System.out.println("  [SQL 失败] " + e.getMessage());
        }
    }
}
