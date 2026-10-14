import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;

/** 只读:RD_PROD_INFO / RD_SPEC_DOC / RD_MOLD_PROC 的 yj_field 全量 + 面板登记。输出 UTF-8。 */
public class _a4fields {
  static StringBuilder sb = new StringBuilder();
  static void p(String s) { sb.append(s).append('\n'); }

  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
    String out = a.length > 1 ? a[1] : "C:/INCER/YINJIA-MES/tools/archive/_a4-prep/_a4-fields.out.txt";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
        + ";encrypt=false;trustServerCertificate=true";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
      p("=== " + db + " ===");
      p("--- yj_panel 列 ---");
      cols(c, "yj_panel");
      p("--- yj_panel 三面板全列 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT * FROM yj_panel WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC','RD_MOLD_PROC')")) {
        ResultSetMetaData m = r.getMetaData();
        while (r.next()) {
          StringBuilder b = new StringBuilder("  ");
          for (int i = 1; i <= m.getColumnCount(); i++) {
            b.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
          }
          p(b.toString());
        }
      }

      p("");
      p("--- yj_field 列 ---");
      cols(c, "yj_field");
      p("--- yj_field ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT * FROM yj_field WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC') "
             + "ORDER BY panel_code, place, seq, id")) {
        ResultSetMetaData m = r.getMetaData();
        String last = "";
        while (r.next()) {
          String pc = r.getString("panel_code");
          if (!pc.equals(last)) { p(""); p("== " + pc + " =="); last = pc; }
          StringBuilder b = new StringBuilder("  ");
          for (int i = 1; i <= m.getColumnCount(); i++) {
            b.append(m.getColumnLabel(i)).append("=").append(r.getString(i)).append(" | ");
          }
          p(b.toString());
        }
      }

      p("");
      p("--- rd_prod_info_head 列 ---");
      cols(c, "rd_prod_info_head");
      p("");
      p("--- rd_spec_doc_head 列 ---");
      cols(c, "rd_spec_doc_head");
      p("");
      p("--- rd_spec_doc_detail 列 ---");
      cols(c, "rd_spec_doc_detail");

      p("");
      p("--- rd_dev_task 表结构 ---");
      cols(c, "rd_dev_task");
      p("--- rd_dev_task 现有行(全部) ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT id, 产品编号, 产品名称, 源单据号, 目标面板, 负责人, 下发人, ISNULL(asp_cancel,'N') FROM rd_dev_task ORDER BY id")) {
        while (r.next()) {
          p("  " + r.getInt(1) + " | " + r.getString(2) + " | " + r.getString(3) + " | " + r.getString(4)
              + " | " + r.getString(5) + " | " + r.getString(6) + " | " + r.getString(7) + " | cancel=" + r.getString(8));
        }
      }

      p("");
      p("--- yj_user 启用账号 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT username, real_name, ISNULL(enabled,'1'), ISNULL(is_admin,'N') FROM yj_user WHERE ISNULL(enabled,'1')='1' ORDER BY id")) {
        while (r.next()) p("  " + r.getString(1) + " | " + r.getString(2) + " | enabled=" + r.getString(3) + " | admin=" + r.getString(4));
      }

      p("");
      p("--- 现有 RD_PROD_INFO 单据 + 状态 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT 单据编号, 产品编号, 产品名称 FROM rd_prod_info_head ORDER BY id")) {
        while (r.next()) p("  " + r.getString(1) + " | " + r.getString(2) + " | " + r.getString(3));
      }
    }
    Files.createDirectories(Paths.get(out).getParent());
    Files.writeString(Paths.get(out), sb.toString(), StandardCharsets.UTF_8);
    System.out.println("written " + out);
  }

  static void cols(Connection c, String t) throws Exception {
    try (Statement s = c.createStatement();
         ResultSet r = s.executeQuery(
             "SELECT c.name, ty.name, c.max_length FROM sys.columns c "
           + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
           + "WHERE c.object_id = OBJECT_ID('" + t + "') ORDER BY c.column_id")) {
      StringBuilder b = new StringBuilder("  ");
      boolean any = false;
      while (r.next()) { b.append(r.getString(1)).append("(").append(r.getString(2)).append(") "); any = true; }
      p(any ? b.toString() : "  <表不存在>");
    }
  }
}
