// QPuData.java —— 测试库找一个可用的供应商 + 物料(造草稿用,只读)
import java.sql.*;
import java.nio.file.*;

public class QPuData {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia", "Yinjia@2026");
             Statement s = c.createStatement()) {
            rs(s, sb, "SELECT panel_code, line_table, head_table FROM yj_panel WHERE RTRIM(panel_code) IN ('GFDA','INV')");
            // 供应商:优先已启用的
            rs(s, sb, "SELECT TOP 3 供应商编码, 供应商名称 FROM dbo.dm_gf WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id");
            rs(s, sb, "SELECT TOP 3 存货编码, 存货名称, 计量单位 FROM dbo.bs_inv ORDER BY id");
            // 币种/汇率(表头必填)看看采购订单同名字段从哪里取
            rs(s, sb, "SELECT TOP 3 币种, 汇率 FROM dbo.bd_pu_order ORDER BY id DESC");
        }
        Files.writeString(Paths.get("archive/_role-view-20261113/_q-pu-data-out.txt"), sb.toString());
        System.out.println("written");
    }

    static void rs(Statement s, StringBuilder sb, String sql) {
        sb.append("\n>> ").append(sql).append("\n");
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = 0;
            while (r.next()) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
                sb.append("\n");
                if (++n > 10) break;
            }
            if (n == 0) sb.append("  (0 rows)\n");
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
