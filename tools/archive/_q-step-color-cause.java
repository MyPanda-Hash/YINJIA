/*
 * 只读探针(2026-10-16)③:定位「有报工但工序步骤不变蓝/不变绿」的样本。
 *   ① 未审核报工(wgzt<>'Y')有多少 —— 完工数据段不过滤 wgzt,工序进度段过滤 ⇒ 两边对不上
 *   ② 行锚定失配:scjl.gd_id 指向的 plang_pc 行 与 该报工 gldh 的 plang 行 不匹配
 *   ③ 逐(工单,行,工序)列出 计划量 / 行锚报工量 / 该工单全部报工量,标出会显示灰的
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-step-color-cause.java
 */
import java.sql.*;

public class _q_step_color_cause {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");

            p("\n### ① scjl.wgzt 取值分布(全部未作废报工) ###");
            q(c, "SELECT ISNULL(wgzt,N'<null>') AS wgzt, COUNT(*) AS 条数 FROM scjl "
                    + "WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wgzt ORDER BY 条数 DESC");

            p("\n### ② 未审核报工(wgzt<>'Y')明细 ###");
            q(c, "SELECT id, gldh, gxdm, sl, wgzt, gd_id, [批次号], asp_time1 FROM scjl "
                    + "WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')<>'Y' ORDER BY id");

            p("\n### ③ gd_id 指向的 plang_pc 是否与报工 gldh 同单(行锚定失配扫描) ###");
            q(c, "SELECT s.id, s.gldh, s.gxdm, s.sl, s.gd_id, pc.pl_no AS pc单号, pc.pl_xc AS pc行号, "
                    + "pc.plang_id, p.pl_no AS plang单号, p.pl_xc AS plang行号, s.[批次号] AS 报工批次, p.[批次号] AS 行批次 "
                    + "FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id "
                    + "WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND (s.gd_id IS NULL OR pc.id IS NULL OR pc.plang_id IS NULL "
                    + "  OR pc.pl_no<>s.gldh OR ISNULL(s.[批次号],N'')<>ISNULL(p.[批次号],N'')) ORDER BY s.id");

            p("\n### ④ 逐(工单,行,工序):计划量 vs 行锚报工量 vs 该单全部报工量 ###");
            q(c, "SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, ISNULL(p.[批次号],N'') AS 批次, p.pl_sl AS 行排产, "
                    + "p.[工艺路线] AS 路线, r.工序名称 AS 工序, ISNULL(r.换算率,1) AS 换算率, "
                    + "ISNULL(p.pl_sl,0)*ISNULL(r.换算率,1) AS 该道计划量, "
                    + "ISNULL((SELECT SUM(ISNULL(s2.sl,0)) FROM scjl s2 LEFT JOIN plang_pc pc2 ON pc2.id=s2.gd_id "
                    + "   WHERE s2.gldh=p.pl_no AND ISNULL(s2.asp_cancel,'N')<>'Y' AND ISNULL(s2.wgzt,'N')='Y' "
                    + "     AND s2.gxdm=r.工序名称 AND (pc2.plang_id=p.id "
                    + "       OR (s2.gd_id IS NULL AND ISNULL(s2.[批次号],N'')=ISNULL(p.[批次号],N'')))),0) AS 行锚已审量, "
                    + "ISNULL((SELECT SUM(ISNULL(s3.sl,0)) FROM scjl s3 WHERE s3.gldh=p.pl_no "
                    + "   AND ISNULL(s3.asp_cancel,'N')<>'Y' AND ISNULL(s3.wgzt,'N')='Y' AND s3.gxdm=r.工序名称),0) AS 整单已审量, "
                    + "ISNULL((SELECT SUM(ISNULL(s4.sl,0)) FROM scjl s4 WHERE s4.gldh=p.pl_no "
                    + "   AND ISNULL(s4.asp_cancel,'N')<>'Y' AND s4.gxdm=r.工序名称),0) AS 整单含未审量 "
                    + "FROM plang p JOIN bs_route r ON r.工艺路线编码=p.[工艺路线] AND ISNULL(r.asp_cancel,'N')<>'Y' "
                    + "WHERE ISNULL(p.asp_cancel,'N')<>'Y' "
                    + "  AND EXISTS (SELECT 1 FROM scjl s5 WHERE s5.gldh=p.pl_no AND ISNULL(s5.asp_cancel,'N')<>'Y') "
                    + "ORDER BY p.pl_no DESC, p.pl_xc, ISNULL(r.加工顺序,999)");
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
