/*
 * 只读探针(2026-10-14):用户当天操作轨迹 + 工单排产相关事实。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q_today_trail.java   (JDK 8+ 亦可)
 */
import java.sql.*;

public class _q_today_trail {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== DB: " + DB + "  now=" + now(c) + " ===");
            p("\n### yj_usage_log 最近 40 条(全部动作) ###");
            q(c, "SELECT TOP 40 id, user_name, panel_name, action_name, doc_no, [工单行号],"
                    + " CONVERT(varchar(19), created_at, 120) AS t FROM yj_usage_log ORDER BY id DESC");

            p("\n### plang 全表(未作废) ###");
            q(c, "SELECT id, pl_no, pl_xc, ISNULL(scx,N'') AS scx, ISNULL(pl_man,N'') AS pl_man,"
                    + " CONVERT(varchar(19), asp_time1, 120) AS 建, CONVERT(varchar(19), asp_time2, 120) AS 改,"
                    + " ISNULL(asp_user2,N'') AS 改人, ISNULL(pl_sl,0) AS 排产, ISNULL(xq_sl,0) AS 需求,"
                    + " ISNULL(ja,'N') AS ja, ISNULL([批次号],N'') AS 批次, ISNULL([工艺路线],N'') AS 路线,"
                    + " ISNULL(od_no,N'') AS 订单号, ISNULL([完工状态],N'') AS 完工状态, ISNULL(rk_sl,0) AS 入库"
                    + " FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id");

            p("\n### wo_process_line(未作废) ###");
            q(c, "SELECT id, 工单号, 工单行id, 工序, ISNULL(工序序,0) AS 序, ISNULL(计划生产线,N'') AS 计划线,"
                    + " ISNULL(实际生产线,N'') AS 实际线, ISNULL(状态,N'') AS 状态, ISNULL(计划数量,0) AS 计划量,"
                    + " CONVERT(varchar(19), asp_time1, 120) AS t FROM dbo.wo_process_line"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工单号, 工序序, id");

            p("\n### plang_pc(排产镜像,未作废) ###");
            q(c, "SELECT id, pl_no, pl_xc, ISNULL(scx,N'') AS scx, plang_id, ISNULL(lb,N'') AS lb,"
                    + " CONVERT(varchar(19), asp_time1, 120) AS t FROM dbo.plang_pc"
                    + " WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id");

            p("\n### yj_user 车间(排产按车间收敛的判据) ###");
            q(c, "SELECT username, ISNULL(real_name,N'') AS real_name, ISNULL(生产车间,N'') AS 车间"
                    + " FROM yj_user ORDER BY username");

            p("\n### bs_prod_line(产线→车间) ###");
            q(c, "SELECT 生产线, ISNULL(生产车间,N'') AS 车间, ISNULL(停用,0) AS 停用, ISNULL(日产能,0) AS 日产能"
                    + " FROM bs_prod_line ORDER BY 生产线");
        }
    }

    static String now(Connection c) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT CONVERT(varchar(19), GETDATE(), 120)")) {
            rs.next(); return rs.getString(1);
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
            System.out.println("  [SQL FAIL] " + e.getMessage());
        }
    }
}
