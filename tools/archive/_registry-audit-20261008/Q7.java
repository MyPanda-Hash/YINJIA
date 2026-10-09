import java.sql.*;
public class Q7 {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false",
              "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
           Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT c.name, c.is_nullable FROM sys.columns c WHERE c.object_id=OBJECT_ID('bs_wh_loc') ORDER BY c.column_id")) {
        StringBuilder sb = new StringBuilder();
        int n = 0;
        boolean hasChang = false;
        while (r.next()) { n++; sb.append(r.getString(1)).append(" "); if (r.getString(1).equals("厂区")) hasChang = true; }
        System.out.println("### " + db + " bs_wh_loc " + n + " 列;含 厂区=" + hasChang);
        System.out.println("    " + sb.toString().trim());
      }
    }
  }
}
