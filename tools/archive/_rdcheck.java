// _rdcheck.java — 校验研发三面板数据量(清理后/测试后)
import java.sql.*;
import java.nio.file.*;
public class _rdcheck {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    String[] tabs = {"rd_approval","rd_approval_detail","rd_plan","rd_plan_detail","rd_progress","rd_progress_detail"};
    sb.append("== 数据量 ==\n");
    for (String t : tabs) {
      ResultSet r = s.executeQuery("SELECT COUNT(*) FROM " + t); r.next();
      sb.append("  ").append(t).append(": ").append(r.getInt(1)).append("\n");
    }
    sb.append("== yj_doc_status ==\n");
    ResultSet r = s.executeQuery("SELECT panel_code, doc_no, CASE WHEN canceled='Y' THEN N'已作废' WHEN shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END FROM yj_doc_status WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_PROGRESS') ORDER BY panel_code, doc_no");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | ").append(r.getString(3)).append("\n");
    sb.append("== 实施计划阶段数据 ==\n");
    r = s.executeQuery("SELECT [单据编号],[项目名称],[项目定级],[负责人],"
        + "[阶段1_计划内容],[阶段1_实际完成],[阶段2_实际完成],[阶段3_实际完成],[阶段4_实际完成],[阶段5_实际完成] FROM rd_plan ORDER BY id");
    while (r.next()) {
      sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | 定级=").append(r.getString(3))
        .append(" | 负责人=").append(r.getString(4)).append("\n");
      sb.append("     阶段1内容=").append(r.getString(5)).append("\n");
      sb.append("     实际完成 1~5: ").append(r.getString(6)).append(" / ").append(r.getString(7)).append(" / ")
        .append(r.getString(8)).append(" / ").append(r.getString(9)).append(" / ").append(r.getString(10)).append("\n");
    }
    sb.append("== 项目进度查询明细 ==\n");
    r = s.executeQuery("SELECT [单据编号],[项目名称],[项目层级],[项目负责],[里程完成],[状态],[子项目/尺寸] FROM rd_progress_detail ORDER BY id");
    while (r.next()) {
      sb.append("  ").append(r.getString(1)).append(" | ").append(r.getString(2)).append(" | 层级=").append(r.getString(3))
        .append(" | 负责=").append(r.getString(4)).append(" | 里程完成=").append(r.getString(5))
        .append(" | 状态=").append(r.getString(6)).append(" | 子项=").append(r.getString(7)).append("\n");
    }
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/_rdcheck-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
