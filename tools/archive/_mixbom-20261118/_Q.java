import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;

/** 只读查询器:逐条执行 SQL(分号分隔的文件),TSV 输出全部行。 */
public class _Q {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String file = a[1];
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        String sql = Files.readString(Path.of(file), StandardCharsets.UTF_8);
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String s : sql.split(";\\s*\\n")) {
                String q = s.trim();
                if (q.isEmpty() || q.startsWith("--")) continue;
                System.out.println("### " + q.replaceAll("\\s+", " "));
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(q)) {
                    ResultSetMetaData m = rs.getMetaData();
                    StringBuilder h = new StringBuilder();
                    for (int i = 1; i <= m.getColumnCount(); i++) h.append(i > 1 ? "\t" : "").append(m.getColumnLabel(i));
                    System.out.println(h);
                    int n = 0;
                    while (rs.next()) {
                        StringBuilder b = new StringBuilder();
                        for (int i = 1; i <= m.getColumnCount(); i++) {
                            if (i > 1) b.append('\t');
                            String v = rs.getString(i);
                            b.append(v == null ? "NULL" : v.replace("\n", "\\n"));
                        }
                        System.out.println(b);
                        n++;
                    }
                    System.out.println("-- rows=" + n);
                } catch (SQLException e) {
                    System.out.println("!! " + e.getMessage());
                }
            }
        }
    }
}
