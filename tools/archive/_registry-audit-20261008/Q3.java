import java.sql.*;
public class Q3 {
  public static void main(String[] a) throws Exception {
    Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false",
      "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
    System.out.println("-- yj_schema_log 列 --");
    try(Statement s=c.createStatement(); ResultSet r=s.executeQuery("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_schema_log') ORDER BY column_id")){
      while(r.next()) System.out.println("   "+r.getString(1));
    }
  }
}
