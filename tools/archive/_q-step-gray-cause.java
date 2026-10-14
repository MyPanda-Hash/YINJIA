/*
 * 只读探针(2026-10-16)④:证明「存在报工但工序步骤不变蓝」的两种失配
 *   A) 行锚定写法不一致:ProcessTaskService(工序进度) 用 `s.gd_id IS NULL` 兜底,
 *      ScheduleBoardService(完工数据) 用 `ISNULL(s.gd_id,0)=0` ⇒ gd_id=0(非 NULL) 的报工
 *      **完工数据看得见、工序进度看不见** ⇒ 步骤停在灰。
 *   B) 工序名不匹配:scjl.gxdm 与 bs_route.工序名称 不等(空格/后缀/异体)⇒ qty 查不到 ⇒ 灰。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-step-gray-cause.java
 */
import java.sql.*;

public class _q_step_gray_cause {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");

            p("\n### A) gd_id 形态分布(未作废报工) ###");
            q(c, "SELECT CASE WHEN gd_id IS NULL THEN N'NULL' WHEN gd_id=0 THEN N'0(非NULL)' ELSE N'>0 可锚定' END AS gd_id形态, "
                    + "COUNT(*) AS 条数, SUM(CASE WHEN ISNULL(wgzt,'N')='Y' THEN 1 ELSE 0 END) AS 已审条数 "
                    + "FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY CASE WHEN gd_id IS NULL THEN N'NULL' WHEN gd_id=0 THEN N'0(非NULL)' ELSE N'>0 可锚定' END");

            p("\n### A2) 已审 + gd_id=0(非NULL) + 有工单号 ⇒ 完工数据可见 / 工序进度不可见 ###");
            q(c, "SELECT s.id, s.gldh, s.gxdm, s.sl, s.gd_id, s.[批次号], s.asp_time1, "
                    + "CASE WHEN s.[批次号] IS NULL THEN N'无批次(两边都兜不到)' ELSE N'有批次' END AS 兜底可能 "
                    + "FROM scjl s WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' "
                    + "AND s.gd_id=0 AND ISNULL(s.gldh,N'')<>N'' ORDER BY s.id");

            p("\n### A3) 已审 + gd_id IS NULL(真 NULL) + 有工单号 ###");
            q(c, "SELECT s.id, s.gldh, s.gxdm, s.sl, s.[批次号], s.asp_time1 FROM scjl s "
                    + "WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' AND s.gd_id IS NULL "
                    + "AND ISNULL(s.gldh,N'')<>N'' ORDER BY s.id");

            p("\n### B) scjl.gxdm 与该工单行的路线工序名对不上的已审报工 ###");
            q(c, "SELECT s.id, s.gldh, N'['+ISNULL(s.gxdm,N'')+N']' AS 报工工序, s.sl, p.pl_xc AS 行号, "
                    + "ISNULL(p.[工艺路线],N'') AS 路线, "
                    + "ISNULL((SELECT TOP 1 N'['+ISNULL(r.工序名称,N'')+N']' FROM bs_route r "
                    + "   WHERE r.工艺路线编码=p.[工艺路线] AND ISNULL(r.asp_cancel,'N')<>'Y' "
                    + "     AND LTRIM(RTRIM(ISNULL(r.工序名称,N'')))=LTRIM(RTRIM(ISNULL(s.gxdm,N'')))),N'<无匹配>') AS 路线同名工序 "
                    + "FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id "
                    + "WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.gxdm,N'')<>N'' "
                    + "  AND NOT EXISTS (SELECT 1 FROM bs_route r WHERE r.工艺路线编码=p.[工艺路线] "
                    + "        AND ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.工序名称,N'')=ISNULL(s.gxdm,N'')) "
                    + "ORDER BY s.id");

            p("\n### C) 该行有已审报工、但工序进度会算成 0 的行(逐行判定) ###");
            q(c, "SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, ISNULL(p.[批次号],N'') AS 批次, ISNULL(p.[工艺路线],N'') AS 路线, "
                    + "ISNULL(SUM(ISNULL(s.sl,0)),0) AS 该行已审报工合计, "
                    + "ISNULL((SELECT SUM(ISNULL(s2.sl,0)) FROM scjl s2 LEFT JOIN plang_pc pc2 ON pc2.id=s2.gd_id "
                    + "   WHERE s2.gldh=p.pl_no AND ISNULL(s2.asp_cancel,'N')<>'Y' AND ISNULL(s2.wgzt,'N')='Y' "
                    + "     AND (pc2.plang_id=p.id OR (s2.gd_id IS NULL AND ISNULL(s2.[批次号],N'')=ISNULL(p.[批次号],N'')))),0) AS 工序进度认到的量 "
                    + "FROM plang p JOIN scjl s ON s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y' "
                    + "WHERE ISNULL(p.asp_cancel,'N')<>'Y' GROUP BY p.pl_no, p.pl_xc, p.[批次号], p.[工艺路线], p.id "
                    + "ORDER BY p.pl_no DESC, p.pl_xc");
        }
    }

    static void p(String s) { System.out.println(s); }

    static void q(Connection c, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            System.out.println(h);
            int rows = 0;
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    Object v = rs.getObject(i);
                    b.append(v == null ? "<null>" : String.valueOf(v).trim());
                    if (i < n) b.append(" | ");
                }
                System.out.println(b);
                rows++;
            }
            System.out.println("(" + rows + " 行)");
        } catch (SQLException e) {
            System.out.println("ERR: " + e.getMessage());
        }
    }
}
