import java.sql.*;
public class Q4 {
  static final String[] NAMES = {"migrate-po-inbound-fields.sql","migrate-material-inspection-field.sql",
    "migrate-inv-inspection-default-no.sql","migrate-chain-insp-fields.sql","migrate-purchase-in-tc-flag.sql",
    "migrate-kingdee-archive-fields.sql"};
  public static void main(String[] a) throws Exception {
    String db=a[0];
    Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false",
      "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
    System.out.println("### "+db);
    for (String n : NAMES) {
      try (PreparedStatement p=c.prepareStatement("SELECT applied_at, LEN(content_hash) FROM yj_schema_log WHERE script_name=?")) {
        p.setString(1,n);
        try (ResultSet r=p.executeQuery()) {
          System.out.printf("  %-46s %s%n", n, r.next() ? ("已登记 @"+r.getString(1)+" hashlen="+r.getInt(2)) : "**未登记**");
        }
      }
    }
    System.out.println("-- bs_inv 检验/类型 相关列 --");
    try (Statement s=c.createStatement(); ResultSet r=s.executeQuery(
      "SELECT c.name, c.is_computed, ty.name ty, c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
      +"WHERE c.object_id=OBJECT_ID('bs_inv') AND (c.name LIKE N'%检验%' OR c.name LIKE N'%类型%')")) {
      while(r.next()) System.out.printf("   %-14s computed=%-6s %-12s len=%s%n", r.getString("name"), r.getBoolean("is_computed"), r.getString("ty"), r.getString("max_length"));
    }
    System.out.println("-- 全库计算列含'检验' --");
    try (Statement s=c.createStatement(); ResultSet r=s.executeQuery(
      "SELECT t.name, c.name, cc.definition FROM sys.computed_columns cc "
      +"JOIN sys.columns c ON c.object_id=cc.object_id AND c.column_id=cc.column_id "
      +"JOIN sys.tables t ON t.object_id=cc.object_id WHERE c.name LIKE N'%检验%'")) {
      boolean any=false; while(r.next()){any=true;System.out.printf("   %s.%s = %s%n",r.getString(1),r.getString(2),r.getString(3));}
      if(!any) System.out.println("   (无 —— 全库没有任何含'检验'的计算列)");
    }
    System.out.println("-- 最近 12 条登记 --");
    try (Statement s=c.createStatement(); ResultSet r=s.executeQuery(
      "SELECT TOP 12 script_name, applied_at FROM yj_schema_log ORDER BY applied_at DESC, script_name")) {
      while(r.next()) System.out.printf("   %-56s %s%n", r.getString(1), r.getString(2));
    }
  }
}
