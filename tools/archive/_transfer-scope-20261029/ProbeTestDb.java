/*
 * ProbeTestDb.java — 2026-10-30 合并后两账套核对(只读):测试库 HSDZ_MES_TEST 是否已经跟上
 * 合并/上一轮新增的迁移对象(wo_day_plan / wo_proc_card_* / self_audit / wo_process_line 计划日期列 等)。
 * 跑法(tools 目录): java -cp lib\mssql-jdbc.jar archive\_transfer-scope-20261029\ProbeTestDb.java
 */
import java.sql.*;

public class ProbeTestDb {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES_TEST");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            System.out.println("== DB " + DB + " ==");
            String[][] objs = {
                    {"U", "wo_day_plan", "日排产(2026-10-29 新增)"},
                    {"U", "wo_proc_card_head", "工序流程追踪卡头(2026-10-29)"},
                    {"U", "wo_proc_card_detail", "工序流程追踪卡行(2026-10-29)"},
                    {"U", "wo_process_line", "工序台账"},
                    {"V", "v_wo_next_process", "下一道工序视图"},
                    {"U", "yj_schema_log", "迁移登记表"},
            };
            for (String[] o : objs) {
                String sql = "SELECT COUNT(*) FROM sys.objects WHERE name=? AND type=?";
                try (PreparedStatement ps = c.prepareStatement(sql)) {
                    ps.setString(1, o[1]); ps.setString(2, o[0]);
                    try (ResultSet r = ps.executeQuery()) {
                        r.next();
                        int n = r.getInt(1);
                        System.out.printf("  %-22s %s  %s%n", o[1], n > 0 ? "[有]" : "[缺]", o[2]);
                    }
                }
            }
            System.out.println("  -- 关键列 --");
            col(c, "wo_process_line", "计划开工日期");
            col(c, "wo_process_line", "计划完工日期");
            col(c, "yj_form_approval", "self_audit");
            col(c, "plang", "工艺路线");
            col(c, "plang", "当前工序");
            System.out.println("  -- 行数抽样 --");
            n(c, "plang", "工单行");
            n(c, "wo_process_line", "工序台账行");
            n(c, "wo_day_plan", "日排产行");
            n(c, "yj_schema_log", "迁移登记");
        }
    }

    static void col(Connection c, String table, String col) throws SQLException {
        Integer n = null;
        try (PreparedStatement ps = c.prepareStatement(
                "SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(?) AND name=?")) {
            ps.setString(1, "dbo." + table); ps.setString(2, col);
            try (ResultSet r = ps.executeQuery()) { r.next(); n = r.getInt(1); }
        }
        System.out.printf("  %-22s.%-12s %s%n", table, col, (n != null && n > 0) ? "[有]" : "[缺]");
    }

    static void n(Connection c, String table, String label) {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery("SELECT COUNT(*) FROM dbo." + table)) {
            r.next(); System.out.printf("  %-14s %d 行%n", label, r.getInt(1));
        } catch (SQLException e) {
            System.out.printf("  %-14s [查询失败] %s%n", label, e.getMessage());
        }
    }
}
