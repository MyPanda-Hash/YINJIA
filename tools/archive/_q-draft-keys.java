/*
 * 只读探针(2026-10-16)⑪:草稿报工带哪些行键?工序进度段只按 ①gd_id ②批次号 收敛,
 *   而 WoReportService.reportRows() 是 ①gd_id ②[工单行号] ③批次号 三级。
 *   若草稿只有 [工单行号](stampRowNo 保存时写入),则工序进度段认不到 ⇒ 有报工也不变蓝。
 * 用法: cd tools && YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar archive\_q-draft-keys.java
 */
import java.sql.*;

public class _q_draft_keys {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");
            p("\n### 每条报工的行键齐备情况(草稿 vs 已审) ###");
            q(c, "SELECT s.id, ISNULL(s.gldh,N'<null>') AS 工单号, ISNULL(s.gxdm,N'') AS 工序, s.sl, "
                    + "CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN N'已审' ELSE N'草稿' END AS 审核, "
                    + "s.gd_id, s.[工单行号], N'['+ISNULL(s.[批次号],N'')+N']' AS 批次, "
                    + "pc.plang_id, p.pl_xc AS 可锚行号, N'['+ISNULL(p.[批次号],N'')+N']' AS 行批次 "
                    + "FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id "
                    + "WHERE ISNULL(s.asp_cancel,'N')<>'Y' ORDER BY s.id");
            p("\n### 若工序进度段加「[工单行号]」锚定级,草稿能认到几行 ###");
            q(c, "SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.id AS 行id, ISNULL(p.pl_sl,0) AS 排产, "
                    + "ISNULL((SELECT SUM(ISNULL(s.sl,0)) FROM scjl s WHERE s.gldh=p.pl_no "
                    + "   AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')<>'Y' "
                    + "   AND ISNULL(s.[工单行号],0)=ISNULL(p.pl_xc,0) AND ISNULL(p.pl_xc,0)>0),0) AS 按行号认到的草稿量 "
                    + "FROM plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' "
                    + "  AND EXISTS (SELECT 1 FROM scjl s WHERE s.gldh=p.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y' "
                    + "     AND ISNULL(s.wgzt,'N')<>'Y') ORDER BY p.pl_no, p.pl_xc");
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
