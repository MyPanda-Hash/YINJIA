// QPuReq.java —— 采购订单「单价 / 仓库」必填现状取证(只读,两账套都跑)
// 用法: java -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QPuReq.java <DB>
import java.sql.*;
import java.nio.file.*;

public class QPuReq {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        StringBuilder sb = new StringBuilder("# " + db + "\n");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            sb.append("\n== yj_panel ==\n");
            rs(s, sb, "SELECT panel_code, mode, head_table, line_table FROM yj_panel WHERE RTRIM(panel_code)='PU_ORDER'");

            sb.append("\n== yj_field:单价/仓库(全库,不限面板) ==\n");
            rs(s, sb, "SELECT RTRIM(panel_code) AS p, RTRIM(place) AS place, seq, col_name, label, data_type, required, hidden, visible "
                    + "FROM yj_field WHERE label LIKE N'%单价%' OR label = N'仓库' ORDER BY p, place, seq");

            sb.append("\n== 物理列可空性(bd_pu_order 头 / bl_pu_order 行) ==\n");
            rs(s, sb, "SELECT t.name AS 表, c.name AS 列, ty.name AS 类型, c.is_nullable AS 可空 "
                    + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
                    + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                    + "WHERE t.name IN ('bd_pu_order','bl_pu_order') AND (c.name LIKE N'%单价%' OR c.name = N'仓库') "
                    + "ORDER BY t.name, c.column_id");
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-pu-req-out.txt"), sb.toString());
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
                if (++n > 60) break;
            }
            if (n == 0) sb.append("  (0 rows)\n");
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
