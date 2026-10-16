package com.yinjia.mes.tools;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
public class DiffProbe {
  static StringBuilder sb = new StringBuilder();
  public static void main(String[] a) throws Exception {
    String url="jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
    try(Connection c=DriverManager.getConnection(url,System.getenv("YINJIA_SQL_USER"),System.getenv("YINJIA_SQL_PASS"))){
      p("### A. 出货检验计划表 RD_INSP_PLAN 的字段(截图4「出货检验项目控制计划」)");
      q(c,"SELECT place, seq, label, col_name, data_type FROM yj_field WHERE panel_code='RD_INSP_PLAN' ORDER BY place, seq");
      p("\n### B. 制程检验单 QC_PROC_INSP 的表头字段");
      q(c,"SELECT seq, label, col_name, data_type FROM yj_field WHERE panel_code='QC_PROC_INSP' AND place LIKE '%header%' ORDER BY seq");
      p("\n### C. 制程检验单 QC_PROC_INSP 的明细字段");
      q(c,"SELECT seq, label, col_name, data_type FROM yj_field WHERE panel_code='QC_PROC_INSP' AND place LIKE '%detail%' AND place NOT LIKE '%header%' ORDER BY seq");
      p("\n### D. 物理表 rd_insp_plan_detail 的列");
      q(c,"SELECT c.name AS col, t.name AS type FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.rd_insp_plan_detail') ORDER BY c.column_id");
      p("\n### F. 关键下拉/参照的字典");
      q(c,"SELECT label, data_type, ISNULL(dict_sql,N'') AS dict, ISNULL(ref_panel,N'') AS refp, ISNULL(ref_field,N'') AS reff FROM yj_field WHERE panel_code='RD_INSP_PLAN' AND (data_type IN (N'下拉框',N'参照')) ORDER BY place, seq");
      p("\n### G. 制程检验单的关键下拉/参照");
      q(c,"SELECT label, data_type, ISNULL(dict_sql,N'') AS dict, ISNULL(ref_panel,N'') AS refp FROM yj_field WHERE panel_code='QC_PROC_INSP' AND data_type IN (N'下拉框',N'参照','日期') ORDER BY place, seq");
      p("\n### E. 数据量");
      q(c,"SELECT 'rd_insp_plan_head' AS t, COUNT(*) AS n FROM rd_insp_plan_head UNION ALL SELECT 'rd_insp_plan_detail', COUNT(*) FROM rd_insp_plan_detail UNION ALL SELECT 'qc_proc_insp_head', COUNT(*) FROM qc_proc_insp_head UNION ALL SELECT 'qc_proc_insp_detail', COUNT(*) FROM qc_proc_insp_detail");
    }
    Files.write(Paths.get("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\diff.txt"), sb.toString().getBytes(StandardCharsets.UTF_8));
    System.out.println("WROTE");
  }
  static void p(String s){ sb.append(s).append("\n"); }
  static void q(Connection c, String sql){
    try(Statement st=c.createStatement(); ResultSet rs=st.executeQuery(sql)){
      ResultSetMetaData m=rs.getMetaData(); int n=m.getColumnCount();
      StringBuilder h=new StringBuilder("  "); for(int i=1;i<=n;i++) h.append(m.getColumnLabel(i)).append(i<n?" | ":"");
      p(h.toString());
      while(rs.next()){ StringBuilder r=new StringBuilder("  ");
        for(int i=1;i<=n;i++){ Object v=rs.getObject(i); r.append(v==null?"":String.valueOf(v).trim()).append(i<n?" | ":""); }
        p(r.toString()); }
    }catch(Exception e){ p("  ERR: "+e.getMessage()); }
  }
}
