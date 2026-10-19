import java.sql.*;

/** 一次性探针:跑只读 SQL(参数:SQL 文件路径),用于排查"已审核单据不可保存"在分批生单路径上的可触发条件。 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String sql = new String(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(a[0])), java.nio.charset.StandardCharsets.UTF_8);
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String stmt : sql.split("(?m)^-- @@\\s*$")) {
                if (stmt.trim().isEmpty()) continue;
                try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(stmt)) {
                    ResultSetMetaData md = rs.getMetaData();
                    StringBuilder h = new StringBuilder();
                    for (int i = 1; i <= md.getColumnCount(); i++) h.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
                    System.out.println(h);
                    while (rs.next()) {
                        StringBuilder b = new StringBuilder();
                        for (int i = 1; i <= md.getColumnCount(); i++) b.append(i > 1 ? " | " : "").append(rs.getString(i));
                        System.out.println(b);
                    }
                    System.out.println();
                } catch (SQLException e) {
                    System.out.println("[ERR] " + e.getMessage());
                }
            }
        }
    }
}
