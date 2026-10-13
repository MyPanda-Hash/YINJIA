import java.sql.*;
public class QFieldDrift {
  public static void main(String[] a) throws Exception {
    try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false","yinjia",
          System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
         Statement s=c.createStatement()) {
      try (ResultSet r=s.executeQuery("SELECT COUNT(*) FROM yj_field WHERE panel_code='MANU_SCHEDULE'")) {
        r.next(); System.out.println("  MANU_SCHEDULE 字段行总数: "+r.getInt(1));
      }
      try (ResultSet r=s.executeQuery("SELECT col_name FROM yj_field WHERE panel_code='MANU_SCHEDULE' AND col_name IN (N'生产车间',N'生产线',N'产能/小时')")) {
        System.out.print("  其中 生产车间/生产线/产能 相关: ");
        boolean any=false; while(r.next()){any=true;System.out.print(r.getString(1)+" ");}
        if(!any) System.out.print("(无)");
        System.out.println();
      }
      try (ResultSet r=s.executeQuery("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.v_manu_schedule') AND c.name IN (N'生产车间',N'生产线',N'产能/小时')")) {
        System.out.print("  当前视图里的对应列: ");
        boolean any=false; while(r.next()){any=true;System.out.print(r.getString(1)+" ");}
        if(!any) System.out.print("(无)");
        System.out.println();
      }
    }
  }
}
