import java.sql.*;
public class QDocPart {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      try (Connection c=DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false","yinjia",
            System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"));
           PreparedStatement p=c.prepareStatement("SELECT applied_at FROM yj_schema_log WHERE script_name=?")) {
        p.setString(1,"_doc_part2_meta.sql");
        try (ResultSet r=p.executeQuery()) {
          System.out.println(db+" _doc_part2_meta.sql: "+(r.next()? "已登记 @"+r.getString(1) : "**未登记(链上但没跑过)**"));
        }
        try (Statement s=c.createStatement(); ResultSet r2=s.executeQuery(
          "SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name IN (N'合同号',N'项目',N'外部单据号',N'资金批次',N'采购类型',N'合同号最新')")) {
          System.out.println("   PURCHASE_IN 这 6 个字段在本库的登记行数: "+(r2.next()? r2.getInt(1):"?"));
        }
        try (Statement s=c.createStatement(); ResultSet r3=s.executeQuery(
          "SELECT COUNT(*) FROM yj_field WHERE panel_code='PURCHASE_IN'")) {
          System.out.println("   PURCHASE_IN 字段总数: "+(r3.next()? r3.getInt(1):"?"));
        }
      }
    }
  }
}
