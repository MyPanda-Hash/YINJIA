import java.sql.*;
public class _chk {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    String[][] checks = {
      {"yj_share_file 表", "SELECT CASE WHEN OBJECT_ID('yj_share_file') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"yj_share_file_cat 表", "SELECT CASE WHEN OBJECT_ID('yj_share_file_cat') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"v_stock_ledger 视图", "SELECT CASE WHEN OBJECT_ID('v_stock_ledger') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"v_stock_summary 视图", "SELECT CASE WHEN OBJECT_ID('v_stock_summary') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"bd_so_order 折前价税合计列", "SELECT CASE WHEN COL_LENGTH('bd_so_order', N'折前价税合计') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"bl_qc_insp 计量单位列", "SELECT CASE WHEN COL_LENGTH('bl_qc_insp', N'计量单位') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"bl_qc_insp 单价列", "SELECT CASE WHEN COL_LENGTH('bl_qc_insp', N'单价') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"yj_field col_group 列", "SELECT CASE WHEN COL_LENGTH('yj_field', 'col_group') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"bl_purchase_in 是否来料检验列", "SELECT CASE WHEN COL_LENGTH('bl_purchase_in', N'是否来料检验') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
      {"bl_qc_return 计量单位列", "SELECT CASE WHEN COL_LENGTH('bl_qc_return', N'计量单位') IS NOT NULL THEN '存在' ELSE '不存在!' END"},
    };
    for (String[] chk : checks) {
      ResultSet r = s.executeQuery(chk[1]); r.next();
      System.out.println("  " + chk[0] + " → " + r.getString(1));
    }
    c.close();
  }
}