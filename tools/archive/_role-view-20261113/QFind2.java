// QFind2.java —— 查 sl_recv(送料暂收单)最近被创建了什么(清理误触「复制」用)
// 用法: java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QFind2.java <DB> <user>
import java.sql.*;
import java.nio.file.*;

public class QFind2 {
    public static void main(String[] a) throws Exception {
        String db = a[0];
        String user = a.length > 1 ? a[1] : "zz_fv_a";
        StringBuilder sb = new StringBuilder("# " + db + " / user=" + user + "\n");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            sb.append("\n== sl_recv 列 ==\n");
            rs(s, sb, "SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.sl_recv') ORDER BY c.column_id");
            sb.append("\n== 最近 3 小时新建(按 id 倒序前 10,附各时间列) ==\n");
            rs(s, sb, "SELECT TOP 10 id, 单据编号, 单据状态, 制单人, 创建时间, 审核人, 审核时间 FROM dbo.sl_recv ORDER BY id DESC");
            sb.append("\n== 制单人 = " + user + " ==\n");
            rs(s, sb, "SELECT id, 单据编号, 单据状态, 制单人, 创建时间 FROM dbo.sl_recv WHERE 制单人 = N'" + user + "' ORDER BY id DESC");
            sb.append("\n== 明细行数(最近 20 张单) ==\n");
            rs(s, sb, "SELECT 单据编号, COUNT(*) AS 行数 FROM dbo.sl_recv_detail WHERE 单据编号 IN "
                    + "(SELECT TOP 20 单据编号 FROM dbo.sl_recv ORDER BY id DESC) GROUP BY 单据编号");
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-find2-out.txt"), sb.toString());
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
