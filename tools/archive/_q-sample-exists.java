/*
 * 只读探针(2026-10-16)⑫:确认旧回归探针的样本工单 GD-2026-10-0002 是否还在库里
 *   —— 用来判定 _verify-wo-trace-by-row.mjs 报「生产工单不存在」是**数据现状**还是本次改动引入。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q-sample-exists.java
 */
import java.sql.*;

public class _q_sample_exists {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== 库: " + DB + " ===");
            p("\n### 旧探针样本 GD-2026-10-0002 是否在 plang(含已作废) ###");
            q(c, "SELECT id, pl_no, pl_xc AS 工单行号, ISNULL(asp_cancel,'N') AS 已作废 FROM plang "
                    + "WHERE pl_no=N'GD-2026-10-0002' ORDER BY id");
            p("\n### plang 里现存工单号(前 20) ###");
            q(c, "SELECT TOP 20 pl_no, COUNT(*) AS 行数 FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' "
                    + "GROUP BY pl_no ORDER BY pl_no DESC");
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
