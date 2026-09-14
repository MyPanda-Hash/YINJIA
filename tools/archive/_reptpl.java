// _reptpl.java — 盘点系统里的报表/打印模板形态 → tools/archive/_reptpl-out.txt
import java.sql.*;
import java.nio.file.*;
public class _reptpl {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    sb.append("== 1. 面板按 mode 分布 ==\n");
    ResultSet r = s.executeQuery("SELECT mode, COUNT(*) FROM yj_panel GROUP BY mode ORDER BY COUNT(*) DESC");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(": ").append(r.getInt(2)).append("\n");
    sb.append("\n== 2. 报表类面板(mode=flat,即明细表/统计表/台账) ==\n");
    r = s.executeQuery("SELECT panel_code, panel_name, category FROM yj_panel WHERE mode = 'flat' ORDER BY category, panel_code");
    int n = 0;
    while (r.next()) { n++; sb.append("  [").append(r.getString(3)).append("] ").append(r.getString(1)).append(" ").append(r.getString(2)).append("\n"); }
    sb.append("  小计: ").append(n).append("\n");
    sb.append("\n== 3. 文书面板(纸面版式打印模板,DOC_ARCHIVE) ==\n");
    String[] docPanels = {"RD_APPROVAL","RD_PLAN","RD_FILTER_EFF","RD_ALKALINE","RD_MINERAL","RD_ANTIBACT","RD_SCALE","RD_RO_PROTECT","RD_SOAK","RD_DROP_PREC","RD_SPIKE_WATER","RD_DOM_TEST","RD_EQUIP_USE","RD_INSTR_USE","RD_MOLD_PROC","RD_MOLD_FORMULA","RD_ASM_BOM","RD_ASM_PROC","RD_SPEC_DOC","RD_INSP_PLAN","RD_PROD_INFO"};
    for (String p : docPanels) {
      ResultSet x = s.executeQuery("SELECT panel_name FROM yj_panel WHERE panel_code = '" + p + "'");
      if (x.next()) sb.append("  ").append(p).append(" ").append(x.getString(1)).append("\n");
    }
    sb.append("  小计: 21(登记于 ButtonService.DOC_ARCHIVE_PANELS)\n");
    sb.append("\n== 4. 遗留打印/报表基础设施(旧ERP s_rep*) ==\n");
    for (String t : new String[]{"s_repformat","s_repheader","s_repbody","s_repdraw","s_repinfo","s_screen","s_remoteprint"}) {
      ResultSet x = s.executeQuery("SELECT COUNT(*) FROM " + t);
      x.next();
      sb.append("  ").append(t).append(": ").append(x.getInt(1)).append(" 行\n");
    }
    sb.append("\n== 5. 用户自定义列设置 report_column_settings ==\n");
    r = s.executeQuery("SELECT COUNT(*), COUNT(DISTINCT panel_code) FROM report_column_settings");
    r.next(); sb.append("  记录数=").append(r.getInt(1)).append(" 覆盖面板=").append(r.getInt(2)).append("\n");
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_reptpl-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
