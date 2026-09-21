import java.sql.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 导出「数据库表清单」生成器的两份输入（正式库 HSDZ_MES）：
 *   tools/gen/db-catalog-tables.tsv   表/视图 名称 + MS_Description + 行数 + 列数
 *   tools/gen/db-catalog-panels.tsv   yj_panel 全表（面板 → 头表/行表 中文名对照）
 *
 * 用法（在 YINJIA-MES 根目录，改完库后重跑）：
 *   java -cp tools/lib/mssql-jdbc.jar tools/gen/GenDbCatalogDump.java
 *   node tools/gen/gen-db-catalog.cjs
 *
 * 注意：Windows 控制台 sqlcmd 输出中文会乱码（GBK 代码页），故走 JDBC 并强制 UTF-8 落盘。
 */
public class GenDbCatalogDump {

  private static final String URL =
      "jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
  private static final String USER = "yinjia";
  private static final String PASS = "Yinjia@2026";
  private static final String OUT_DIR = "tools/gen/";

  public static void main(String[] args) throws Exception {
    try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
      int t = dumpTables(c);
      int p = dumpPanels(c);
      System.out.println("done: tables+views=" + t + ", panels=" + p);
    }
  }

  /** 表 + 视图：名称 / 中文说明(MS_Description) / 行数 / 列数 */
  private static int dumpTables(Connection c) throws Exception {
    String q =
        "SELECT CASE o.type WHEN 'V' THEN 'VIEW' ELSE 'TABLE' END AS kind, "
      + "  s.name AS sch, o.name AS nm, "
      + "  ISNULL(CAST(ep.value AS NVARCHAR(500)),'') AS ds, "
      + "  (SELECT SUM(pp.rows) FROM sys.partitions pp WHERE pp.object_id=o.object_id AND pp.index_id IN (0,1)) AS rws, "
      + "  (SELECT COUNT(*) FROM sys.columns cc WHERE cc.object_id=o.object_id) AS cc "
      + "FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id "
      + "LEFT JOIN sys.extended_properties ep ON ep.major_id=o.object_id AND ep.minor_id=0 AND ep.name='MS_Description' "
      + "WHERE o.is_ms_shipped=0 AND o.type IN ('U','V') "
      + "ORDER BY o.type DESC, o.name";
    int n = 0;
    try (PrintWriter out = writer(OUT_DIR + "db-catalog-tables.tsv");
         Statement st = c.createStatement();
         ResultSet rs = st.executeQuery(q)) {
      out.println("kind\tschema\tname\tdesc\trows\tcolcount");
      while (rs.next()) {
        out.println(rs.getString(1) + "\t" + rs.getString(2) + "\t" + rs.getString(3) + "\t"
            + cell(rs.getString(4)) + "\t" + rs.getObject(5) + "\t" + rs.getObject(6));
        n++;
      }
    }
    return n;
  }

  /** yj_panel 全表：面板名单是表中文名的权威补充来源 */
  private static int dumpPanels(Connection c) throws Exception {
    List<String> cols = new ArrayList<>();
    try (ResultSet rs = c.getMetaData().getColumns(null, "dbo", "yj_panel", null)) {
      while (rs.next()) cols.add(rs.getString("COLUMN_NAME"));
    }
    StringBuilder q = new StringBuilder("SELECT ");
    for (int i = 0; i < cols.size(); i++) {
      if (i > 0) q.append(", ");
      q.append("ISNULL(CAST([").append(cols.get(i)).append("] AS NVARCHAR(300)),'')");
    }
    q.append(" FROM yj_panel ORDER BY panel_code");
    int n = 0;
    try (PrintWriter out = writer(OUT_DIR + "db-catalog-panels.tsv");
         Statement st = c.createStatement();
         ResultSet rs = st.executeQuery(q.toString())) {
      out.println(String.join("\t", cols));
      while (rs.next()) {
        for (int i = 1; i <= cols.size(); i++) {
          if (i > 1) out.print("\t");
          out.print(cell(rs.getString(i)));
        }
        out.println();
        n++;
      }
    }
    return n;
  }

  private static PrintWriter writer(String path) throws IOException {
    return new PrintWriter(new OutputStreamWriter(
        new FileOutputStream(path), StandardCharsets.UTF_8));
  }

  /** TSV 单元格：去掉制表符与换行，避免破坏列结构 */
  private static String cell(String s) {
    return s == null ? "" : s.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ');
  }
}
