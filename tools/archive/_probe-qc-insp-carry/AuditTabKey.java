import java.sql.*;

/**
 * 一次性核对:本轮新增的 yj_field.tab_key 是否满足《数据库规范》体检项
 * (03 列级中文注明 / 05 元数据漂移 / 07 重复登记行),并列出体检说的"3 列英文/拼音列名无注明"到底是谁
 * —— 用来确认 audit 的 FAIL-7 是不是本轮引入的(预期:不是,全是存量)。
 * 运行:java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/AuditTabKey.java
 */
public class AuditTabKey {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "① yj_field.tab_key 是否存在 + 中文注明(体检 03)",
                    "SELECT c.name AS 列, CAST(ep.value AS nvarchar(300)) AS 注明 FROM sys.columns c "
                            + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                            + "WHERE c.object_id=OBJECT_ID('yj_field') AND c.name='tab_key'");
            q(c, "② 体检 03:英文/拼音列名且无注明的列(全库,斜体找嫌疑)",
                    "SELECT t.name AS 表名, c.name AS 列名 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
                            + "WHERE c.name NOT LIKE N'%[一-龥]%' AND t.name NOT LIKE N'%_bak%' AND t.name <> 'sysdiagrams' "
                            + "AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description') "
                            + "ORDER BY t.name, c.column_id");
            q(c, "③ 体检 07:完全重复的字段登记行(是否涉及 QC_INSP_REQ)",
                    "SELECT panel_code, col_name, label, COUNT(*) AS 重复数 FROM yj_field GROUP BY panel_code, col_name, label HAVING COUNT(*)>1 ORDER BY 重复数 DESC");
            q(c, "④ 体检 05:QC_INSP_REQ 字段是否都在 qc_insp_req 里(含 tab_key 新增字段)",
                    "SELECT f.col_name AS 登记列, CASE WHEN c.name IS NULL THEN N'缺列!' ELSE N'ok' END AS 物理列 FROM yj_field f "
                            + "LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID('qc_insp_req') AND c.name=f.col_name "
                            + "WHERE f.panel_code='QC_INSP_REQ' AND f.col_name LIKE N'备用%'");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n== " + title + " ==");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(h);
            int n = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(rs.getString(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(sb);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
