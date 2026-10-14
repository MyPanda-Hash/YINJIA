import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;

/** A4 数据准备 · 落库读回验证(只读):直接读 HSDZ_MES_TEST 的物理表,证明"数据真落对地方"。 */
public class _a4verify {
  static StringBuilder sb = new StringBuilder();
  static void p(String s) { sb.append(s).append('\n'); }

  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
    String piNo = a.length > 1 ? a[1] : "PI-2026-10-0019";
    String sdNo = a.length > 2 ? a[2] : "SD-2026-10-0004";
    String code = a.length > 3 ? a[3] : "A4TEST01";
    String out = a.length > 4 ? a[4] : "C:/INCER/YINJIA-MES/tools/archive/_a4-prep/_a4-verify.out.txt";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
        + ";encrypt=false;trustServerCertificate=true";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {

      p("=== " + db + " 落库读回 · " + piNo + " / " + sdNo + " / 产品编号 " + code + " ===");

      p("");
      p("【A】rd_prod_info_head");
      dump(c, "SELECT 单据编号,单据日期,产品编号,产品名称,客户项目名称,客户料号,产品管控等级,产品功能类别,产品类别,"
          + "产品类型,产品整体尺寸,炭棒内径,炭棒外径,炭棒长度,特殊性能描述,产品形态,责任人,审核人一级,审核人二级,备注 "
          + "FROM rd_prod_info_head WHERE 单据编号 = ?", piNo);

      p("");
      p("【B】yj_doc_status(两单)");
      dump(c, "SELECT panel_code,doc_no,pending,pending_by,approve_node,l2_approver,archived,shr,shsj,canceled "
          + "FROM yj_doc_status WHERE doc_no IN (?,?) ORDER BY panel_code", piNo, sdNo);

      p("");
      p("【C】rd_dev_task(按产品编号读回 = 分发是否真落库)");
      dump(c, "SELECT id,产品编号,产品名称,源单据号,目标面板,负责人,下发人,CONVERT(varchar(19),下发时间,120) AS 下发时间,asp_cancel "
          + "FROM rd_dev_task WHERE 产品编号 = ? ORDER BY id", code);

      p("");
      p("【D】rd_spec_doc_head");
      dump(c, "SELECT 单据编号,单据日期,规格书种类,名称,产品编号,产品类别,客户项目名称,应用场景,客户名,客户料号,版本,"
          + "日期,适用范围,整体规格参数,产品主要性能,炭棒处理要求,包装方式,出货检验报告,运输要求,存储环境,备注 "
          + "FROM rd_spec_doc_head WHERE 单据编号 = ?", sdNo);

      p("");
      p("【E】rd_spec_doc_detail(检验要求区逐行)");
      dump(c, "SELECT id,单据编号,表区,序号,检验项目,检验要求,检验方法,检验依据,asp_cancel "
          + "FROM rd_spec_doc_detail WHERE 单据编号 = ? ORDER BY id", sdNo);

      p("");
      p("【F】rd_spec_doc_detail 里 检验项目 的逐字字节核对(防全/半角、空格)");
      try (PreparedStatement ps = c.prepareStatement(
              "SELECT 序号,检验项目, LEN(检验项目) AS 字符数, DATALENGTH(检验项目)/2 AS 字节对数 FROM rd_spec_doc_detail"
                  + " WHERE 单据编号 = ? AND 表区 = N'检验要求' ORDER BY 序号")) {
        ps.setString(1, sdNo);
        try (ResultSet r = ps.executeQuery()) {
          while (r.next()) p("  序号=" + r.getString(1) + " 检验项目=[" + r.getString(2) + "] 字符数=" + r.getInt(3)
              + " 字节对数=" + r.getInt(4));
        }
      }

      p("");
      p("【G】yj_doc_status 是否存在其它 doc 占用同一产品编号(排查 matched>1 干扰)");
      dump(c, "SELECT h.单据编号,h.产品编号, CASE WHEN ISNULL(s.archived,'N')='Y' THEN N'已归档'"
          + " WHEN ISNULL(s.shr,N'')<>N'' THEN N'已审核' ELSE N'草稿/其它' END AS 状态"
          + " FROM rd_spec_doc_head h LEFT JOIN yj_doc_status s ON s.panel_code='RD_SPEC_DOC' AND s.doc_no=h.单据编号"
          + " WHERE h.产品编号 = ? AND ISNULL(h.asp_cancel,'N')<>'Y'", code);
    }
    Files.createDirectories(Paths.get(out).getParent());
    Files.writeString(Paths.get(out), sb.toString(), StandardCharsets.UTF_8);
    System.out.println("written " + out);
  }

  static void dump(Connection c, String sql, Object... args) throws Exception {
    try (PreparedStatement ps = c.prepareStatement(sql)) {
      for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
      try (ResultSet r = ps.executeQuery()) {
        ResultSetMetaData m = r.getMetaData();
        int n = 0;
        StringBuilder h = new StringBuilder("  ");
        for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append(" | ");
        p(h.toString());
        while (r.next()) {
          n++;
          StringBuilder b = new StringBuilder("  ");
          for (int i = 1; i <= m.getColumnCount(); i++) {
            String v = r.getString(i);
            b.append(v == null ? "<null>" : v.replace("\n", "\\n")).append(" | ");
          }
          p(b.toString());
        }
        if (n == 0) p("  <无行>");
      }
    }
  }
}
