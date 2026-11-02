import java.nio.file.*; import java.sql.*; import java.util.*;
public class _Pending {
  public static void main(String[] a) throws Exception {
    String db = a[0];
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    Set<String> done = new HashSet<>();
    try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
         Statement s = c.createStatement(); ResultSet r = s.executeQuery("SELECT script_name FROM yj_schema_log")) {
      while (r.next()) done.add(r.getString(1));
    }
    List<String> pend = new ArrayList<>();
    for (String line : Files.readAllLines(Path.of("tools/db-migrations.txt"))) {
      String t = line.trim(); if (t.isEmpty() || t.startsWith("#")) continue;
      if (!done.contains(t)) pend.add(t);
    }
    System.out.println(db + " pending " + pend.size());
    pend.forEach(p -> System.out.println("  " + p));
  }
}
