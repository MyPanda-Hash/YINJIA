// _peek.java — 探不明用途表的列名 → tools/archive/_peek-out.txt
import java.sql.*;
import java.nio.file.*;
public class _peek {
  public static void main(String[] args) throws Exception {
    String[] tabs = {"yj_attachment","yj_message","yj_plan_term","yj_std_lib","yj_schema_log",
      "qr_batch_registry","report_column_settings","form_flow_link","wo_material_pick",
      "rd_dev_task","rd_spec_assign","rd_product_info","bd_account","bd_expense_type","bd_tax_type",
      "bd_so_order","bs_reject","bs_route","bs_wc","bs_qc_item","bs_qc_plan"};
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    for (String t : tabs) {
      sb.append("== ").append(t).append(" ==\n");
      try {
        ResultSet r = s.executeQuery("SELECT TOP 8 c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('" + t + "') ORDER BY c.column_id");
        while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
      } catch (SQLException e) { sb.append("  (err)").append("\n"); }
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_peek-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
