import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Q5.java — 枚举体检 09 的全部缺失项(面板/字段标签,含 skiplabel 白名单口径),只读 */
public class Q5 {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    Path tools = Path.of(System.getProperty("user.dir"));
    Set<String> skip = new HashSet<>();
    for (String l : Files.readAllLines(tools.resolve("db-legacy-whitelist.txt"), StandardCharsets.UTF_8)) {
      String t = l.trim();
      if (t.startsWith("skiplabel:")) skip.add(t.substring(10));
    }
    try (Connection c = DriverManager.getConnection(
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {

      System.out.println("=== " + db + " 面板缺 en(全部)===");
      try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
          "SELECT RTRIM(p.panel_code) code, RTRIM(p.panel_name) nm FROM yj_panel p WHERE NOT EXISTS ("
        + "SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=RTRIM(p.panel_name) AND t.locale='en')"
        + " ORDER BY p.panel_code")) {
        int n = 0;
        while (rs.next()) { n++; System.out.printf("  %2d. %-22s %s%n", n, rs.getString(1), rs.getString(2)); }
      }

      System.out.println();
      System.out.println("=== 字段标签缺 en(去白名单后,全部)===");
      List<String> labels = new ArrayList<>();
      try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
          "SELECT f.label FROM yj_field f WHERE NOT EXISTS ("
        + "SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')"
        + " GROUP BY f.label ORDER BY f.label")) {
        while (rs.next()) labels.add(rs.getString(1));
      }
      int n = 0;
      for (String l : labels) {
        if (skip.contains(l)) continue;
        n++;
        System.out.printf("  %3d. %s%n", n, l);
      }
      System.out.println("  (白名单免译 " + (labels.size() - n) + " 项未列)");
    }
  }
}
