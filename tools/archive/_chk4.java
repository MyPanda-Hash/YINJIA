import java.sql.*;
public class _chk4 {
  public static void main(String[] a) throws Exception {
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    String[][] checks = {
      {"qc_insp_detail 单价", "SELECT CASE WHEN COL_LENGTH('qc_insp_detail', N'单价') IS NOT NULL THEN 1 ELSE 0 END"},
      {"qc_insp_detail 计量单位", "SELECT CASE WHEN COL_LENGTH('qc_insp_detail', N'计量单位') IS NOT NULL THEN 1 ELSE 0 END"},
      {"qc_return_detail 计量单位", "SELECT CASE WHEN COL_LENGTH('qc_return_detail', N'计量单位') IS NOT NULL THEN 1 ELSE 0 END"},
      {"sl_recv_detail 计量单位", "SELECT CASE WHEN COL_LENGTH('sl_recv_detail', N'计量单位') IS NOT NULL THEN 1 ELSE 0 END"},
    };
    for (String[] chk : checks) {
      ResultSet r = s.executeQuery(chk[1]); r.next();
      System.out.println(chk[0] + " = " + (r.getInt(1) == 1 ? "EXISTS" : "MISSING"));
    }
    // yj_field 检查
    ResultSet r = s.executeQuery("SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'单价'");
    r.next(); System.out.println("QC_INSP yj_field 单价 = " + r.getInt(1));
    r = s.executeQuery("SELECT COUNT(*) FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'计量单位'");
    r.next(); System.out.println("QC_RETURN yj_field 计量单位 = " + r.getInt(1));
    c.close();
  }
}