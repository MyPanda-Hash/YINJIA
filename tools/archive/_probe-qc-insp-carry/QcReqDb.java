import java.sql.*;

/**
 * 一次性排障:来料检验要求 qc_insp_req 的**数据是否还在**(用户口径「数据是空的,保存后数据也会为空」)。
 * 只读查询,不改数据。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/QcReqDb.java [库名]
 */
public class QcReqDb {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== 库 " + db + " ===");
            q(c, "行总数/存活/已作废", "SELECT COUNT(*) AS 总数, "
                    + "SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废, "
                    + "SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活 FROM qc_insp_req");
            q(c, "按页签存活行数", "SELECT 物料类别, COUNT(*) AS 行数 FROM qc_insp_req "
                    + "WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料类别 ORDER BY 行数 DESC");
            q(c, "最近 8 行(id 倒序,看有没有被作废)", "SELECT TOP 8 id, 物料类别, 物料编号, "
                    + "ISNULL(asp_cancel,'N') AS 作废, CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间, asp_user1 AS 写入人 "
                    + "FROM qc_insp_req ORDER BY id DESC");
            q(c, "面板登记", "SELECT panel_code, mode, line_table, detail_key FROM yj_panel WHERE panel_code='QC_INSP_REQ'");
            q(c, "归档保存留痕(近 10 次)", "SELECT TOP 10 id, user_name, CONVERT(nvarchar(19), saved_at, 120) AS 保存时间, "
                    + "change_meta FROM yj_archive_change_log WHERE panel_code='QC_INSP_REQ' ORDER BY id DESC");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n-- " + title + " --");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(head);
            int n = 0;
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(v == null ? "(null)" : v).append(i < m.getColumnCount() ? " | " : "");
                }
                System.out.println(row);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
