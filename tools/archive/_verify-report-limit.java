import java.sql.*;
/** Read-only boundary evidence: current 161/160 is within 101%; next unit is not. */
class _verify_report_limit {
 public static void main(String[] a)throws Exception{
  String p=System.getenv("YINJIA_SQL_PASS");
  try(Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true","yinjia",p);
      PreparedStatement q=c.prepareStatement("SELECT p.pl_sl, SUM(CASE WHEN RTRIM(s.wgzt)='Y' THEN s.sl ELSE 0 END) FROM plang p JOIN plang_pc pc ON pc.plang_id=p.id JOIN scjl s ON s.gd_id=pc.id WHERE p.pl_no='GD-2026-10-0007' AND s.gxdm=? AND s.asp_cancel<>'Y' GROUP BY p.pl_sl")){
   for(String op:new String[]{"成型","切炭","组装"}){q.setString(1,op);try(ResultSet r=q.executeQuery()){if(!r.next())throw new AssertionError(op);double plan=r.getDouble(1),done=r.getDouble(2);System.out.printf("%s plan=%.4f done=%.4f limit=%.4f within=%s%n",op,plan,done,plan*1.01,done<=plan*1.01+0.0001);if(done>plan*1.01+0.0001)throw new AssertionError(op);}}
  }
 }
}
