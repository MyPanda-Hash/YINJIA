import java.sql.*;

/** Q1.java — 核验 migrate-inv-inspection-default-no.sql 退场理由的事实(只读) */
public class Q1 {
  public static void main(String[] a) throws Exception {
    String db = a[0];
    Connection c = DriverManager.getConnection(
      "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false", "yinjia",
      System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
    System.out.println("### " + db);
    String q = "SELECT t.name tab, c.name col, c.is_computed, ty.name ty, c.max_length, cc.definition "
      + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
      + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
      + "LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id "
      + "WHERE t.name IN ('bs_inv','bl_purchase_in') AND c.name LIKE N'%检验%' ORDER BY t.name, c.column_id";
    try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(q)) {
      while (r.next()) System.out.printf("%-16s %-16s computed=%-5s %-12s len=%-5s def=%s%n",
        r.getString("tab"), r.getString("col"), r.getBoolean("is_computed"), r.getString("ty"),
        r.getString("max_length"), r.getString("definition"));
    }
    System.out.println("-- yj_schema_log 命中 --");
    try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
        "SELECT script_name FROM yj_schema_log WHERE script_name LIKE '%po-inbound%' OR script_name LIKE '%inv-inspection%'")) {
      boolean any = false;
      while (r.next()) { any = true; System.out.println("   " + r.getString(1)); }
      if (!any) System.out.println("   (无输出 = 该脚本从未登记)");
    }
    System.out.println("-- bs_inv.来料检验 值分布 --");
    try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(
        "SELECT ISNULL(RTRIM(来料检验),'<NULL>') v, COUNT(*) n FROM bs_inv GROUP BY RTRIM(来料检验) ORDER BY COUNT(*) DESC")) {
      while (r.next()) System.out.println("   [" + r.getString(1) + "] = " + r.getInt(2));
    } catch (SQLException e) { System.out.println("   [失败] " + e.getMessage().split("\n")[0]); }
  }
}
