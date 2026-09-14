// _verify_comments.java — 注释覆盖率验证 + 可疑缺表确认 → tools/archive/_verify_comments-out.txt
import java.sql.*;
import java.nio.file.*;
public class _verify_comments {
  public static void main(String[] args) throws Exception {
    StringBuilder sb = new StringBuilder();
    Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false", "yinjia", "Yinjia@2026");
    Statement s = c.createStatement();
    ResultSet r = s.executeQuery("SELECT (SELECT COUNT(*) FROM sys.tables) AS total, (SELECT COUNT(*) FROM sys.tables t JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description' AND ep.value IS NOT NULL) AS commented");
    r.next();
    sb.append("总表数=").append(r.getInt(1)).append(" 已注释=").append(r.getInt(2)).append("\n");
    sb.append("\n== 仍无注释的表 ==\n");
    r = s.executeQuery("SELECT t.name FROM sys.tables t WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description' AND ep.value IS NOT NULL) ORDER BY t.name");
    while (r.next()) sb.append("  ").append(r.getString(1)).append("\n");
    sb.append("\n== 可疑表存在性(20260911 结构调整) ==\n");
    for (String t : new String[]{"rd_mold_formula_head","rd_mold_formula_detail","rd_asm_bom_head","rd_asm_bom_detail","rd_mold_proc_head","rd_mold_proc_detail"}) {
      ResultSet x = s.executeQuery("SELECT CASE WHEN OBJECT_ID('" + t + "') IS NULL THEN N'不存在!' ELSE N'存在' END");
      x.next(); sb.append("  ").append(t).append(": ").append(x.getString(1)).append("\n");
    }
    sb.append("\n== 抽样注释效果 ==\n");
    r = s.executeQuery("SELECT t.name, CAST(ep.value AS nvarchar(400)) FROM sys.tables t JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description' WHERE t.name IN ('yj_panel','yj_field','wo_order','rd_plan','qc_disposal','form_flow_link','kucun','s_allno','rd_plan_bak_20260911') ORDER BY t.name");
    while (r.next()) sb.append("  ").append(r.getString(1)).append(" → ").append(r.getString(2)).append("\n");
    c.close();
    Files.write(Paths.get("C:/INCER/YINJIA-MES/tools/archive/_verify_comments-out.txt"), sb.toString().getBytes("UTF-8"));
    System.out.println("written");
  }
}
