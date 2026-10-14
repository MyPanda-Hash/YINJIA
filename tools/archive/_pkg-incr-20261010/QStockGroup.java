import java.sql.*;
public class QStockGroup {
  public static void main(String[] a) throws Exception {
    String[] panels={"STOCK_BALANCE","STOCK_LEDGER","STOCK_STATUS","STOCK_SUMMARY"};
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false","yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"))) {
        System.out.println("### "+db);
        try (PreparedStatement p=c.prepareStatement("SELECT panel_code, module_group, CAST(module_group AS VARBINARY(20)) AS raw FROM yj_panel WHERE panel_code=?")) {
          for (String pc : panels) {
            p.setString(1, pc);
            try (ResultSet r=p.executeQuery()) {
              System.out.printf("   %-14s module_group=[%s] raw=%s%n", pc,
                r.next()? r.getString(2) : "(无此行)", r.getRow()==0? "—" : "");
            }
          }
        }
        try (Statement s=c.createStatement(); ResultSet r=s.executeQuery(
          "SELECT COUNT(*) FROM yj_panel WHERE CAST(module_group AS VARBINARY(20)) LIKE 0x3F00")) {
          System.out.println("   全库 module_group 含半角问号的面板数: "+(r.next()? r.getInt(1):"?"));
        }
      }
    }
  }
}
