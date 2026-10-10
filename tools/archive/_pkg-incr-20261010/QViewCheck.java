import java.sql.*;
public class QViewCheck {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false","yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
           Statement s=c.createStatement()) {
        try (ResultSet r=s.executeQuery("SELECT OBJECT_ID('dbo.v_manu_schedule','V') AS oid")) {
          r.next();
          Object oid=r.getObject(1);
          System.out.println("  "+db+" v_manu_schedule 存在? "+(oid!=null? "是 (object_id="+oid+")" : "**否 —— 视图已丢**"));
        }
        try (ResultSet r=s.executeQuery("SELECT COUNT(*) FROM yj_panel WHERE panel_code='MANU_SCHEDULE'")) {
          r.next(); System.out.println("      MANU_SCHEDULE 面板行: "+r.getInt(1));
        }
      }
    }
  }
}
