import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;

/** 只读:规格书明细表区/检验项目取值 + 成型工艺清单表头所在物理表。 */
public class _q_spec {
  static StringBuilder sb = new StringBuilder();
  static void p(String s) { sb.append(s).append('\n'); }

  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
        + ";encrypt=false;trustServerCertificate=true";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
      p("=== " + db + " ===");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT COUNT(*) FROM rd_spec_doc_detail")) {
        r.next(); p("rd_spec_doc_detail 行数 = " + r.getInt(1));
      }
      p("--- 表区 分布 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT [表区], COUNT(*) FROM rd_spec_doc_detail GROUP BY [表区]")) {
        while (r.next()) p("  [" + r.getString(1) + "] " + r.getInt(2));
      }
      p("--- 检验要求区 检验项目 全部取值 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT DISTINCT [检验项目] FROM rd_spec_doc_detail WHERE [表区]=N'检验要求'")) {
        while (r.next()) p("  · " + r.getString(1));
      }
      p("--- 检验要求区 最近 3 单 样例行 ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT TOP 6 [单据编号],[检验项目],[检验要求],[检验方法] FROM rd_spec_doc_detail "
             + "WHERE [表区]=N'检验要求' ORDER BY [单据编号] DESC")) {
        while (r.next()) p("  " + r.getString(1) + " | " + r.getString(2) + " | "
            + String.valueOf(r.getString(3)).replace("\n", "\\n") + " | " + r.getString(4));
      }
      p("--- RD_MOLD_PROC 表头物理表 列(含 炭棒尺寸/跌落强度/抗压强度/压降/表单管理人/版本号) ---");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery(
               "SELECT t.name, c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id "
             + "WHERE c.name IN (N'炭棒尺寸',N'跌落强度',N'抗压强度',N'压降',N'表单管理人',N'版本号') "
             + "AND t.name LIKE 'rd_mold%' ORDER BY t.name, c.column_id")) {
        while (r.next()) p("  " + r.getString(1) + " . " + r.getString(2));
      }
    }
    Files.writeString(Paths.get(a.length > 1 ? a[1] : "C:/INCER/YINJIA-MES/tools/archive/_docdefaults-a4/_q-spec.out.txt"),
        sb.toString(), StandardCharsets.UTF_8);
    System.out.println("written " + db);
  }
}
