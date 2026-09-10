// _Qry.java — 批号追溯视图核验:INIT-T382 全链时间线 + CL001/CL004 测试批号
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      System.out.println("== INIT-T382 时间线 ==");
      ResultSet r = s.executeQuery("SELECT 事件, 单据编号, 数量, 仓库, 状态, 相关人, 对象 FROM v_lot_trace WHERE 批号 = 'INIT-T382' ORDER BY 单据日期, 单据编号");
      while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getDouble(3) + " | 仓=" + r.getString(4) + " | " + r.getString(5) + " | " + r.getString(6) + " | " + r.getString(7));
      System.out.println("== 测试批号(20260909*) 时间线(前8) ==");
      r = s.executeQuery("SELECT TOP 8 批号, 事件, 单据编号, 数量 FROM v_lot_trace WHERE 批号 LIKE '20260909%' ORDER BY 批号, 单据编号");
      while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getDouble(4));
    }
  }
}
