import java.sql.*;
public class _chk3 {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    System.out.println("== qc/insp/return related tables ==");
    ResultSet r = s.executeQuery("SELECT name FROM sys.tables WHERE name LIKE '%qc%' OR name LIKE '%insp%' OR name LIKE '%return%' OR name LIKE '%recv%' OR name LIKE '%sl_%' ORDER BY name");
    while (r.next()) System.out.println("  " + r.getString(1));
    System.out.println("== yj_panel insp/recv codes ==");
    r = s.executeQuery("SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code LIKE '%INSP%' OR panel_code LIKE '%RECV%' OR panel_code LIKE '%RETURN%' OR panel_code LIKE '%SL_%' ORDER BY panel_code");
    while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | head=" + r.getString(3) + " | line=" + r.getString(4));
    c.close();
  }
}