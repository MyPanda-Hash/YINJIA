import java.sql.*;

/**
 * 一次性排查:正式库里"被填过值"的备用列到底是哪几行(判断是不是测试数据、能不能清)。
 * 只读。运行:java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/DirtySpareRows.java
 */
public class DirtySpareRows {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            q(c, "有备用列数据的行(全库只有这些行被填过)",
                    "SELECT id, 物料类别, 物料编号, [备用1] AS 备用1, [备用2] AS 备用2, [备用3] AS 备用3, "
                            + "[备用141] AS 备用141, ISNULL(asp_cancel,'N') AS 作废, CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间, asp_user1 AS 写入人 "
                            + "FROM qc_insp_req WHERE [备用1] IS NOT NULL OR [备用2] IS NOT NULL OR [备用3] IS NOT NULL OR [备用141] IS NOT NULL");
            q(c, "自定义检验要求 页签的行",
                    "SELECT id, 物料编号, [备用1], [备用2], [备用141], CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间, asp_user1 AS 写入人 "
                            + "FROM qc_insp_req WHERE 物料类别 = N'自定义检验要求' ORDER BY id");
            q(c, "本表 备用列 有数据的列统计",
                    "SELECT COUNT(*) AS 有备用1 FROM qc_insp_req WHERE [备用1] IS NOT NULL");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n-- " + title + " --");
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
