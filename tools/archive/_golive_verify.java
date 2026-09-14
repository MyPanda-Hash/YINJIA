// _golive-verify.java — 清理后核验各表行数 → tools/archive/_golive-verify-out.txt
import java.sql.*;
import java.nio.file.*;
public class _golive_verify {
  public static void main(String[] args) throws Exception {
    String[] tables = {
      "bd_pu_req","bl_pu_req","bd_pu_order","bl_pu_order","bd_purchase_in","bl_purchase_in",
      "bd_sale_out","bl_sale_out","bd_material_out","bl_material_out","bd_finish_in","bl_finish_in",
      "bd_other_in","bl_other_in","bd_other_out","bl_other_out",
      "bd_outsource_in","bl_outsource_in","bd_outsource_issue","bl_outsource_issue",
      "bd_outsource_order","bl_outsource_order","bd_manu_order","bl_manu_order","bd_dispatch","bl_dispatch",
      "bd_so_order","bl_so_order",
      "qc_recv","qc_recv_detail","qc_insp","qc_insp_detail","qc_return","qc_return_detail",
      "qc_op","qc_op_detail","qc_disposal","qc_record","qc_record_detail",
      "wo_order","wo_progress","wo_report","wo_stage_report","wo_line_stock","wo_material_pick",
      "day_report","day_report_detail","feed_confirm","feed_confirm_detail","mix_record","mix_record_detail",
      "gran_record","gran_record_detail","wh_record","wh_record_detail","pack_confirm","pack_confirm_detail",
      "equip_check","equip_check_detail","maint_plan","maint_plan_detail","sample_req","sample_req_detail",
      "rod_return","rod_return_detail",
      "rd_approval","rd_plan","rd_progress","rd_prod_info_head","rd_spec_doc_head","rd_spec_assign","rd_dev_task",
      "qr_batch_registry","yj_plan_term","yj_message","yj_attachment",
      "yj_doc_status","yj_doc_modify_log","yj_form_approval","yj_usage_log","form_flow_link","report_column_settings",
      "s_allno","yj_lot_seq"
    };
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    sb.append("== 清理后行数(应全为 0) ==\n");
    int bad = 0;
    for (String t : tables) {
      long n = -999;
      try (ResultSet r = s.executeQuery("SELECT COUNT(*) FROM " + t)) { r.next(); n = r.getLong(1); }
      catch (SQLException e) { n = -1; }
      sb.append("  ").append(t).append(" = ").append(n).append("\n");
      if (n > 0) bad++;
    }
    sb.append("异常表数: ").append(bad).append("\n");
    sb.append("== 保留项抽检 ==\n");

    try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM kucun WHERE asp_user1 = 'migration'")) { x.next();
      sb.append("  期初库存(migration 建行,保留): ").append(x.getInt(1)).append("\n"); }
    try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM bd_so_order")) { x.next();
      sb.append("  ERP同步销售订单(保留): ").append(x.getInt(1)).append("\n"); }
    try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM bs_inv")) { x.next();
      sb.append("  存货档案(保留): ").append(x.getInt(1)).append("\n"); }
    try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM yj_panel")) { x.next();
      sb.append("  面板元数据(保留): ").append(x.getInt(1)).append("\n"); }
    try (ResultSet x = s.executeQuery("SELECT COUNT(*) FROM yj_user")) { x.next();
      sb.append("  用户(保留): ").append(x.getInt(1)).append("\n"); }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_golive-verify-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
