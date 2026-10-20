import java.sql.*;

/**
 * 只读:模拟"部署后旧单据"的三种真实形态,判断流程页会不会查不到 / 报错。
 *   ① 立项有单据但 文档编号 为空(老口径手填/未填)
 *   ② 计划存在但 文档编号 对不上任何立项单号(关联键断)
 *   ③ 立项/计划缺 yj_doc_status 行(功能上线前的老单)
 */
public class _Q11 {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
            String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
                System.out.println("== " + db + " ==");
                q(c, "① 立项 文档编号为空", "SELECT [单据编号] + ' | 机型=' + ISNULL([机型及应用位置],'-') + ' | 等级=' + ISNULL([项目等级],'-') FROM rd_approval WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([文档编号],N'') = N''");
                q(c, "② 计划对不上任何立项(文档编号断链)", "SELECT p.[单据编号] + ' | 文档编号=' + ISNULL(NULLIF(p.[文档编号],N''),'(空)') + ' | 项目=' + ISNULL(p.[项目名称],'-') + ' | 负责人=' + ISNULL(p.[负责人],'-') + ' FROM rd_plan p WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.[文档编号],N'') <> N'' AND NOT EXISTS (SELECT 1 FROM rd_approval a WHERE ISNULL(a.asp_cancel,'N') <> 'Y' AND (a.[单据编号] = p.[文档编号] OR ISNULL(a.[文档编号],N'') = p.[文档编号]))");
                q(c, "③ 缺 yj_doc_status 行的立项", "SELECT [单据编号] FROM rd_approval a WHERE ISNULL(a.asp_cancel,'N') <> 'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='RD_APPROVAL' AND s.doc_no=a.[单据编号])");
                q(c, "③ 缺 yj_doc_status 行的计划", "SELECT [单据编号] FROM rd_plan p WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='RD_PLAN' AND s.doc_no=p.[单据编号])");
                q(c, "④ 立项↔计划 按项目名称可配对但编号断链", "SELECT a.[单据编号] + ' <-> ' + p.[单据编号] FROM rd_approval a JOIN rd_plan p ON p.[项目名称] = a.[机型及应用位置] AND ISNULL(p.asp_cancel,'N') <> 'Y' WHERE ISNULL(a.asp_cancel,'N') <> 'Y' AND ISNULL(a.[机型及应用位置],N'') <> N'' AND ISNULL(a.[单据编号],N'') <> ISNULL(p.[文档编号],N'') AND NOT EXISTS (SELECT 1 FROM rd_plan q WHERE q.[文档编号] = a.[单据编号] AND ISNULL(q.asp_cancel,'N') <> 'Y')");
            }
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            boolean any = false;
            while (rs.next()) { any = true; System.out.println("  " + label + ": " + rs.getString(1)); }
            if (!any) System.out.println("  " + label + ": (空)");
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
