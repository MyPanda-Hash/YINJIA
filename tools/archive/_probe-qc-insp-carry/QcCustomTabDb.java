import java.sql.*;

/**
 * 只读核对:QC_INSP_REQ.物料类别 词表 + 自定义页签行数 + 该面板动态字段绑定情况。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/QcCustomTabDb.java [库名]
 */
public class QcCustomTabDb {
    public static void main(String[] args) throws Exception {
        for (String db : (args.length > 0 ? new String[]{args[0]} : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"})) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
            System.out.println("\n=========== " + db + " ===========");
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                q(c, "物料类别词表(含自定义?)",
                        "SELECT CASE WHEN dict_sql LIKE N'%自定义检验要求%' THEN N'含自定义检验要求' ELSE N'缺!' END AS 状态, dict_sql "
                                + "FROM yj_field WHERE panel_code='QC_INSP_REQ' AND col_name=N'物料类别'");
                q(c, "各页签存活行数",
                        "SELECT 物料类别 AS 页签, COUNT(*) AS 行数 FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y' "
                                + "GROUP BY 物料类别 ORDER BY 行数 DESC");
                q(c, "本面板动态字段(备用列绑定)",
                        "SELECT col_name AS 列, label AS 中文名, place AS 位置, seq FROM yj_field "
                                + "WHERE panel_code='QC_INSP_REQ' AND col_name LIKE N'备用%' ORDER BY seq, id");
                q(c, "检验项标准库条目数(qc.insp_item)",
                        "SELECT COUNT(*) AS 条目数, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS 启用 FROM yj_std_lib WHERE lib_code=N'qc.insp_item'");
                q(c, "自定义页签数据行(若有)",
                        "SELECT TOP 5 id, 物料编号, 备用1, 备用2 FROM qc_insp_req WHERE 物料类别=N'自定义检验要求' "
                                + "AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("-- " + title + " --");
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
                System.out.println(row.length() > 220 ? row.substring(0, 220) + "…" : row);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
