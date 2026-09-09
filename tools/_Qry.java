// _Qry.java — 实例登录名与库所有者侦察
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      System.out.println("== server principals (SQL/Windows logins) ==");
      try (ResultSet r = s.executeQuery("SELECT name, type_desc, is_disabled, CAST(is_sysadmin AS varchar) FROM (SELECT name, type_desc, is_disabled, CASE WHEN type='S' AND name='sa' THEN 1 ELSE 0 END AS is_sysadmin FROM sys.server_principals WHERE type IN ('S','U') AND name NOT LIKE '##%') t")) {
        while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | disabled=" + r.getString(3));
      } catch (Exception e) { System.out.println("  ERR: " + e.getMessage().split("\n")[0]); }
      System.out.println("== HSDZ_MES owner ==");
      try (ResultSet r = s.executeQuery("SELECT d.name, SUSER_SNAME(d.owner_sid), d.owner_sid FROM sys.databases d WHERE d.name='HSDZ_MES'")) {
        while (r.next()) System.out.println("  db=" + r.getString(1) + " owner=" + r.getString(2) + " sid=" + r.getString(3));
      } catch (Exception e) { System.out.println("  ERR: " + e.getMessage().split("\n")[0]); }
      System.out.println("== yinjia server perms ==");
      try (ResultSet r = s.executeQuery("SELECT p.permission_name FROM sys.server_principals pr JOIN sys.server_permissions p ON p.grantee_principal_id = pr.principal_id WHERE pr.name='yinjia'")) {
        while (r.next()) System.out.println("  " + r.getString(1));
      } catch (Exception e) { System.out.println("  ERR: " + e.getMessage().split("\n")[0]); }
    }
  }
}
