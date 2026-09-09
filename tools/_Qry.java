// _Qry.java — 补真实子件到 M-001 BOM(修数据而非改视图) → 齐套视图复验
import java.sql.*;
public class _Qry {
  public static void main(String[] a) throws Exception {
    try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026")) {
      Statement s = c.createStatement();
      // 找一个真实原材料(bs_inv 非产成品类)
      ResultSet r = s.executeQuery("SELECT TOP 2 存货编码, 存货名称 FROM bs_inv WHERE 所属类别 = N'原材料' AND ISNULL(停用,0)=0");
      String code = null, name = null;
      while (r.next()) { code = r.getString(1); name = r.getString(2); System.out.println("选用子件: " + code + " " + name); }
      if (code == null) { r = s.executeQuery("SELECT TOP 1 存货编码, 存货名称 FROM bs_inv"); while (r.next()) { code = r.getString(1); name = r.getString(2); } System.out.println("兜底子件: " + code + " " + name); }
      // 更新 M-001 的占位行:填子件 + 单件用量 0.05(测试值,可后台改)
      int n = s.executeUpdate("UPDATE bs_bom SET 子件编码 = N'" + code + "', 子件名称 = N'" + name.replace("'", "''") + "', 定额数量 = 0.05, 备注 = N'e2e补齐子件' WHERE 父件编码 = N'M-001' AND ISNULL(默认BOM,0)=1 AND (子件编码 IS NULL OR 子件编码 = N'')");
      System.out.println("更新占位行: " + n);
      System.out.println("== v_wo_kit (GD-2026-09-0003) 复验 ==");
      r = s.executeQuery("SELECT 子件编码, 子件名称, 需求数量, 库存结余, 齐套缺口 FROM v_wo_kit WHERE 工单号='GD-2026-09-0003'");
      while (r.next()) System.out.println("  " + r.getString(1) + " | " + r.getString(2) + " | 需求=" + r.getDouble(3) + " | 结余=" + r.getDouble(4) + " | 缺口=" + r.getDouble(5));
    }
  }
}
