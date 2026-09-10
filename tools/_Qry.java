// _Qry.java — 报工进度核验(wo_progress GD-0002)
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      ResultSet r = s.executeQuery("SELECT 工序, 计划数量, 完成数量 FROM wo_progress WHERE 单据编号 = N'GD-2026-09-0002' ORDER BY id");
      while (r.next()) System.out.println("  " + r.getString(1) + " | 计划=" + r.getDouble(2) + " | 完成=" + r.getDouble(3));
      r = s.executeQuery("SELECT 成型完成, 混料完成, 未完成数量 FROM v_wo_schedule WHERE 工单号 = N'GD-2026-09-0002'");
      while (r.next()) System.out.println("  视图: 成型完成=" + r.getDouble(1) + " | 混料完成=" + r.getDouble(2) + " | 未完成=" + r.getDouble(3));
    }
  }
}
