import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** 只读核对 yj_field:任务1(表单管理人/版本号默认值)与任务2(规格书检验要求映射)的字段真名。输出 UTF-8 文件。 */
public class _q_fields {
  static StringBuilder sb = new StringBuilder();
  static void p(String s) { sb.append(s).append('\n'); }

  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
        + ";encrypt=false;trustServerCertificate=true";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
      String panels = "('RD_MOLD_PROC','RD_MOLD_FORMULA','RD_ASM_PROC','RD_INSP_PLAN','RD_SPEC_DOC')";
      p("=== " + db + " yj_field ===");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT f.panel_code, f.label, f.col_name, f.seq, f.place, f.editable, f.visible "
             + "FROM yj_field f WHERE f.panel_code IN " + panels
             + " AND (f.label LIKE N'%管理人%' OR f.label LIKE N'%版本%' OR f.label LIKE N'%密级%'"
             + "  OR f.label LIKE N'%范围%' OR f.label LIKE N'%审核%' OR f.label LIKE N'%编写%'"
             + "  OR f.label IN (N'炭棒尺寸',N'跌落强度',N'抗压强度',N'压降')) "
             + "ORDER BY f.panel_code, f.seq")) {
        while (r.next()) {
          p(String.format("%-18s | %-8s | col=%-8s | seq=%-4s | %-8s | editable=%s visible=%s",
              r.getString(1), r.getString(2), r.getString(3), r.getString(4),
              r.getString(5), r.getString(6), r.getString(7)));
        }
      }

      p("");
      p("=== 规格书明细物理表候选 ===");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT t.name, c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id "
             + "WHERE t.name LIKE '%spec%detail%' OR t.name LIKE 'rd_spec%' ORDER BY t.name, c.column_id")) {
        while (r.next()) p("  " + r.getString(1) + " . " + r.getString(2));
      }

      p("");
      p("=== RD_SPEC_DOC 明细表区/检验项目 取值 ===");
      for (String tbl : new String[]{"rd_spec_doc_detail", "rd_spec_doc_dt"}) {
        try (Statement s = c.createStatement();
             ResultSet r = s.executeQuery(
                 "SELECT DISTINCT d.[表区], d.[检验项目] FROM " + tbl + " d WHERE d.[检验项目] IS NOT NULL")) {
          p("-- " + tbl + " --");
          while (r.next()) p("  [" + r.getString(1) + "] " + r.getString(2));
        } catch (SQLException e) { p("-- " + tbl + " : " + e.getMessage()); }
      }
    }
    Files.writeString(Paths.get(a.length > 1 ? a[1] : "C:/INCER/YINJIA-MES/tools/archive/_docdefaults-a4/_q-fields.out.txt"),
        sb.toString(), StandardCharsets.UTF_8);
    System.out.println("written");
  }
}
