/*
 * 只读探针(2026-10-16)⑩:① plang_pc.id 取值范围(确认 id=0 不是有效锚点,可安全把
 *   「未锚定」统一判为 ISNULL(gd_id,0)=0);② 复核 ScheduleBoardService.完工数据 段
 *   不过滤 wgzt ⇒ 草稿报工会出现在「完工数据」却不出现在「工序步骤」(用户报障"有报工不变蓝")。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-draft-gap.java
 */
import java.sql.*;

public class _q_draft_gap {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");
            p("\n### ① plang_pc.id 取值范围(id=0 是否是有效锚点) ###");
            q(c, "SELECT MIN(id) AS 最小id, MAX(id) AS 最大id, COUNT(*) AS 行数, "
                    + "SUM(CASE WHEN id=0 THEN 1 ELSE 0 END) AS id为0的行数 FROM plang_pc");
            p("\n### ② plang_pc.id=0 是否被任何 scjl.gd_id 引用 ###");
            q(c, "SELECT COUNT(*) AS 引用数 FROM scjl WHERE gd_id=0");
            p("\n### ③ 「完工数据」段(不过滤 wgzt)与「工序步骤」段(过滤 wgzt='Y')的差异样本 ###");
            q(c, "SELECT s.gldh AS 工单号, s.gxdm AS 工序, ISNULL(s.wgzt,N'<null>') AS wgzt, "
                    + "SUM(ISNULL(s.sl,0)) AS 数量, COUNT(*) AS 单数, "
                    + "N'完工数据可见' AS 完工数据, "
                    + "CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN N'工序步骤也可见' ELSE N'工序步骤看不到(会显灰)' END AS 工序步骤 "
                    + "FROM scjl s WHERE ISNULL(s.asp_cancel,'N')<>'Y' "
                    + "GROUP BY s.gldh, s.gxdm, s.wgzt HAVING ISNULL(s.wgzt,'N')<>'Y' ORDER BY s.gldh");
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
