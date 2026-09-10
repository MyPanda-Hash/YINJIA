// _verify.java — 全链路核验:工单五工序进度 / 双批号追溯事件 / kucun 台账余额
// 用法: java -cp <jdbc> tools/_verify.java <工单号> <材料批号> <产品批号>
import java.sql.*;
public class _verify {
  public static void main(String[] a) throws Exception {
    String wo = a[0], lot = a[1], plot = a[2];
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      System.out.println("-- 工序进度 " + wo);
      boolean progOk = true;
      double[] expect = {1000, 334, 1000, 950, 900};
      String[] ops = {"混料", "成型", "切炭", "组装", "装箱"};
      ResultSet r = s.executeQuery("SELECT 工序, 完成数量 FROM wo_progress WHERE 单据编号 = N'" + wo + "' ORDER BY id");
      int i = 0;
      while (r.next()) {
        double done = r.getDouble(2);
        System.out.println("  " + r.getString(1) + " 完成=" + done);
        if (i < 5 && done != expect[i]) progOk = false;
        i++;
      }
      System.out.println(progOk && i == 5 ? "WO_PROGRESS_OK" : "WO_PROGRESS_FAIL");
      System.out.println("-- 材料批追溯 " + lot);
      r = s.executeQuery("SELECT 事件, 单据编号, 数量 FROM v_lot_trace WHERE 批号 = '" + lot + "' ORDER BY 单据编号");
      StringBuilder ev = new StringBuilder();
      while (r.next()) { ev.append(r.getString(1)).append("(").append(r.getDouble(3)).append(") "); System.out.println("  " + r.getString(1) + " " + r.getString(2) + " " + r.getDouble(3)); }
      String e = ev.toString();
      System.out.println(e.contains("暂收") && e.contains("来料检验") && e.contains("采购入库") && e.contains("领料出库") ? "TRACE_MAT_OK" : "TRACE_MAT_FAIL");
      System.out.println("-- 产品批追溯 " + plot);
      r = s.executeQuery("SELECT 事件, 单据编号, 数量 FROM v_lot_trace WHERE 批号 = '" + plot + "' ORDER BY 单据编号");
      ev.setLength(0);
      while (r.next()) { ev.append(r.getString(1)).append("(").append(r.getDouble(3)).append(") "); System.out.println("  " + r.getString(1) + " " + r.getString(2) + " " + r.getDouble(3)); }
      e = ev.toString();
      System.out.println(e.contains("成品入库") && e.contains("销售出库") && e.contains("不良处置") ? "TRACE_PROD_OK" : "TRACE_PROD_FAIL");
      System.out.println("-- 台账核验");
      boolean ok = true;
      // T382 材料仓(WH-CL)新批: 入180 出50 → yl=130
      r = s.executeQuery("SELECT yl FROM kucun WHERE wzdm='T382' AND ckdm='WH-CL' AND lot_no='" + lot + "'");
      double t382 = r.next() ? r.getDouble(1) : -1;
      System.out.println("  T382|材料仓|" + lot + " yl=" + t382 + " (期望130)");
      ok &= t382 == 130;
      // M-001 半成品仓(CK04): 入900 出800 移40 → yl=60
      r = s.executeQuery("SELECT yl FROM kucun WHERE wzdm='M-001' AND ckdm='CK04' AND lot_no='" + plot + "'");
      double m1 = r.next() ? r.getDouble(1) : -1;
      System.out.println("  M-001|半成品仓|" + plot + " yl=" + m1 + " (期望60)");
      ok &= m1 == 60;
      // M-001 不良品仓: 40
      r = s.executeQuery("SELECT ISNULL(SUM(yl),0) FROM kucun WHERE wzdm='M-001' AND lot_no='" + plot + "' AND ckdm IN (SELECT 仓库编码 FROM bs_wh WHERE 仓库名称=N'不良品仓')");
      double bad = r.next() ? r.getDouble(1) : -1;
      System.out.println("  M-001|不良品仓 yl=" + bad + " (期望40)");
      ok &= bad == 40;
      System.out.println(ok ? "LEDGER_OK" : "LEDGER_FAIL");
    }
  }
}
