import java.sql.*;
public class _chk2 {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    String[] tables = {"bl_qc_insp", "bl_qc_return", "sl_recv_detail"};
    for (String t : tables) {
      System.out.println("== " + t + " columns ==");
      ResultSet r = s.executeQuery("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('" + t + "') ORDER BY column_id");
      StringBuilder sb = new StringBuilder();
      while (r.next()) sb.append(r.getString(1)).append(", ");
      System.out.println("  " + sb);
    }
    c.close();
  }
}