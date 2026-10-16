/*
 * 只读探针:制程检验单字段与「格数」改造前的现状取证。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_q_qcproc_cols.java
 */
import java.sql.*;

public class _q_qcproc_cols {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] a) throws Exception {
        Class.forName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;trustServerCertificate=true",
                "yinjia", PASS)) {
            System.out.println("=== DB: " + DB + " ===");
            p("\n### QC_PROC_INSP detail fields ###");
            q(c, "SELECT col_name, label, data_type, place, seq, width, editable, required, hidden, visible "
                    + "FROM yj_field WHERE panel_code=N'QC_PROC_INSP' ORDER BY seq");
            p("\n### hidden detail fields elsewhere (pattern check) ###");
            q(c, "SELECT TOP 10 panel_code, col_name, label, place, hidden, visible FROM yj_field "
                    + "WHERE hidden=1 AND place LIKE N'%detail%' ORDER BY panel_code");
            p("\n### QC_PROC_INSP rows with blank sector ###");
            q(c, "SELECT COUNT(*) AS blank_sector FROM qc_proc_insp_detail WHERE 表区 IS NULL OR LTRIM(RTRIM(表区))=N''");
            p("\n### live rows by doc/sector ###");
            q(c, "SELECT 单据编号, 表区, 检验项目, 测量值1, 测量值2, 测量值3, 测量值4, 测量值5, 实测数值, 单项判定 "
                    + "FROM qc_proc_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC, 表区, id");
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
            System.out.println("(" + rows + " rows)");
        } catch (SQLException e) {
            System.out.println("ERR: " + e.getMessage());
        }
    }
}
