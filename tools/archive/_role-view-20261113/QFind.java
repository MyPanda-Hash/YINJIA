// QFind.java —— 查 QC_RECV 这张单最近被创建了什么(清理误触「复制」用)
// 用法: java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QFind.java <DB> [user]
import java.sql.*;
import java.nio.file.*;

public class QFind {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String user = a.length > 1 ? a[1] : "zz_fv_a";
        StringBuilder sb = new StringBuilder("# " + db + " / user=" + user + "\n");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            rs(s, sb, "SELECT panel_code, mode, line_table, head_table, group_col, pk_col FROM yj_panel WHERE RTRIM(panel_code)='QC_RECV'");
            // qc_recv 头表:先看有哪些候选表
            rs(s, sb, "SELECT name FROM sys.tables WHERE name LIKE 'qc_recv%' ORDER BY name");
            rs(s, sb, "SELECT TOP 10 c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.qc_recv_head') ORDER BY c.column_id");
            sb.append("\n== 最近 2 小时新建的暂收单(任何操作人) ==\n");
            rs(s, sb, "SELECT TOP 20 单据编号, 单据日期, 单据状态, 供应商代码, 制单人, 创建时间 "
                    + "FROM dbo.qc_recv_head WHERE 创建时间 > DATEADD(hour, -2, SYSDATETIME()) ORDER BY 创建时间 DESC");
            sb.append("\n== 抄送/创建人 = " + user + " 的单 ==\n");
            rs(s, sb, "SELECT TOP 20 单据编号, 单据状态, 制单人, 创建时间 FROM dbo.qc_recv_head WHERE 制单人 = N'" + user + "' ORDER BY 创建时间 DESC");
            sb.append("\n== 对应明细行数 ==\n");
            rs(s, sb, "SELECT TOP 20 单据编号, COUNT(*) AS 行数 FROM dbo.qc_recv_detail WHERE 单据编号 IN "
                    + "(SELECT 单据编号 FROM dbo.qc_recv_head WHERE 创建时间 > DATEADD(hour,-2,SYSDATETIME())) GROUP BY 单据编号");
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-find-out.txt"), sb.toString());
        System.out.println("written");
    }

    static void rs(Statement s, StringBuilder sb, String sql) {
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = 0;
            while (r.next()) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
                sb.append("\n");
                if (++n > 40) break;
            }
            if (n == 0) sb.append("  (0 rows)\n");
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
