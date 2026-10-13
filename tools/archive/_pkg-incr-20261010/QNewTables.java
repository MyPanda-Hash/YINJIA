import java.sql.*;
public class QNewTables {
  public static void main(String[] a) throws Exception {
    try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false","yinjia",
          System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"))) {
      for (String t : new String[]{"qc_fin_spec_head","qc_fin_spec_detail"}) {
        try (Statement s=c.createStatement()) {
          ResultSet r=s.executeQuery("SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('"+t+"')");
          int cols = r.next()? r.getInt(1):-1;
          r=s.executeQuery("SELECT CAST(ep.value AS nvarchar(200)) FROM sys.extended_properties ep WHERE ep.major_id=OBJECT_ID('"+t+"') AND ep.minor_id=0 AND ep.name='MS_Description'");
          String desc = r.next()? r.getString(1) : "(无表级注明)";
          r=s.executeQuery("SELECT COUNT(*) FROM ["+t+"]");
          int rows = r.next()? r.getInt(1):-1;
          System.out.printf("  %-22s 列 %-4d 行 %-6d 注明: %s%n", t, cols, rows, desc);
        }
      }
      System.out.println("  -- 绑定这两个表的面板 --");
      try (Statement s=c.createStatement(); ResultSet r=s.executeQuery(
        "SELECT panel_code, panel_name, category, module_group, head_table, line_table FROM yj_panel WHERE head_table IN (N'qc_fin_spec_head') OR line_table IN (N'qc_fin_spec_detail')")) {
        while (r.next()) System.out.printf("     %-16s %-24s 分类=%s 分组=%s head=%s line=%s%n",
          r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6));
      }
    }
  }
}
