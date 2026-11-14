// QRecon.java —— 角色字段视图(2026-11-13)开工前取证:只读,不改任何数据
// 用法: cd tools && java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_role-view-20261113\QRecon.java [DB]
import java.sql.*;
import java.nio.file.*;

public class QRecon {
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false";

    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        StringBuilder sb = new StringBuilder();
        sb.append("# DB=").append(db).append("\n");
        try (Connection c = DriverManager.getConnection(String.format(URL, db), "yinjia", "Yinjia@2026")) {
            Statement s = c.createStatement();

            sb.append("\n== yj_role 列 ==\n");
            dumpCols(s, sb, "yj_role");
            sb.append("\n== yj_role 行 ==\n");
            dumpRows(s, sb, "SELECT * FROM yj_role ORDER BY id", 40);

            sb.append("\n== yj_user 列 ==\n");
            dumpCols(s, sb, "yj_user");

            sb.append("\n== yj_field 列 ==\n");
            dumpCols(s, sb, "yj_field");

            sb.append("\n== yj_field 总行数 / 隐藏行 / 改过栏名 ==\n");
            rs(s, "SELECT COUNT(*) AS 字段行, SUM(CASE WHEN visible=0 OR hidden=1 THEN 1 ELSE 0 END) AS 隐藏行, "
                    + "SUM(CASE WHEN alias IS NOT NULL AND LTRIM(RTRIM(alias))<>'' THEN 1 ELSE 0 END) AS 改过栏名 "
                    + "FROM yj_field", sb);

            sb.append("\n== 样本面板 SL_RECV 字段现状 ==\n");
            rs(s, "SELECT place, seq, col_name, label, alias, hidden, visible FROM yj_field "
                    + "WHERE panel_code='SL_RECV' ORDER BY place, seq, id", sb);

            sb.append("\n== yj_field 整表校验和(迁移前后比对,证明一行未动) ==\n");
            rs(s, "SELECT COUNT(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(panel_code, place, seq, col_name, label, alias, hidden, visible, editable, required)) AS ck "
                    + "FROM yj_field", sb);

            sb.append("\n== 是否已存在 yj_field_view ==\n");
            rs(s, "SELECT ISNULL(OBJECT_ID(N'dbo.yj_field_view', N'U'), -1) AS object_id", sb);

            sb.append("\n== yj_role_panel 样本 ==\n");
            rs(s, "SELECT TOP 5 panel_code, perms FROM yj_role_panel ORDER BY id", sb);
        }
        Path out = Paths.get("archive/_role-view-20261113/_q-recon-out.txt");
        Files.writeString(out, sb.toString());
        System.out.println("written -> " + out.toAbsolutePath());
    }

    static void dumpCols(Statement s, StringBuilder sb, String t) {
        rs(s, "SELECT c.name AS n, ty.name AS ty, c.max_length AS len, c.is_nullable AS nul, c.is_identity AS ident "
                + "FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                + "WHERE c.object_id=OBJECT_ID('" + t + "') ORDER BY c.column_id", sb);
    }

    static void dumpRows(Statement s, StringBuilder sb, String sql, int max) throws SQLException {
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = 0;
            while (r.next() && n++ < max) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
                sb.append("\n");
            }
        }
    }

    static void rs(Statement s, String sql, StringBuilder sb) {
        try (ResultSet r = s.executeQuery(sql)) {
            ResultSetMetaData m = r.getMetaData();
            int n = 0;
            while (r.next()) {
                sb.append("  ");
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
                sb.append("\n");
                if (++n > 200) { sb.append("  ...(truncated)\n"); break; }
            }
            if (n == 0) sb.append("  (0 rows)\n");
        } catch (SQLException e) {
            sb.append("  (err) ").append(e.getMessage()).append("\n");
        }
    }
}
