import java.sql.*;
public class Q {
  static final String URL="jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false";
  public static void main(String[] a) throws Exception {
    try(Connection c=DriverManager.getConnection(URL,"yinjia",System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"))){
      for(String sql: a){
        System.out.println("\n=== "+sql);
        try(Statement s=c.createStatement(); ResultSet r=s.executeQuery(sql)){
          ResultSetMetaData m=r.getMetaData(); int n=m.getColumnCount();
          StringBuilder h=new StringBuilder(); for(int i=1;i<=n;i++) h.append(m.getColumnLabel(i)).append(i<n?" | ":"");
          System.out.println(h);
          while(r.next()){ StringBuilder b=new StringBuilder(); for(int i=1;i<=n;i++){ Object o=r.getObject(i); b.append(o==null?"NULL":String.valueOf(o)).append(i<n?" | ":""); } System.out.println(b); }
        }catch(Exception e){ System.out.println("ERR: "+e.getMessage()); }
      }
    }
  }
}
