import java.sql.*;
public class QFourCount {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false","yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
           Statement s=c.createStatement()) {
        try (ResultSet r=s.executeQuery("SELECT panel_code, COUNT(*) FROM yj_field WHERE panel_code IN (N'QC_RECV',N'QC_INSP',N'QC_RETURN',N'PURCHASE_IN') GROUP BY panel_code ORDER BY panel_code")) {
          int tot=0; StringBuilder sb=new StringBuilder();
          while(r.next()){ sb.append(r.getString(1)).append('=').append(r.getInt(2)).append(' '); tot+=r.getInt(2); }
          System.out.println("  "+db+": 四单字段行 "+sb+"合计="+tot+(tot==329?" (=329 脚本守卫成立)":" (**≠329** 脚本守卫会 RAISERROR)"));
        }
      }
    }
  }
}
