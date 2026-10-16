import java.sql.*;
public class QK {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      String url="jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false;trustServerCertificate=true";
      try (Connection c=DriverManager.getConnection(url,"yinjia","Yinjia@2026")) {
        System.out.println("########## "+db+" ##########");
        q(c, "按 表区 × 有无结果判断 统计",
          "SELECT ISNULL(表区,N'(null)') AS 表区, CASE WHEN ISNULL(结果判断,N'')=N'' THEN N'(空)' ELSE 结果判断 END AS 结果判断,"
        + " SUM(CASE WHEN 测量值1 IS NOT NULL THEN 1 ELSE 0 END) AS 有测量值, COUNT(*) AS 行数"
        + " FROM dbo.qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 表区, 结果判断 ORDER BY 表区");
        q(c, "行级样例(含 检验项目/结果判断/处理方式/测量值1)",
          "SELECT TOP 12 单据编号, ISNULL(表区,N'') AS 表区, ISNULL(检验项目,N'') AS 检验项目,"
        + " ISNULL(结果判断,N'') AS 结果判断, ISNULL(处理方式,N'') AS 处理方式, 测量值1, 不合格数量"
        + " FROM dbo.qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC, id");
        q(c, "头表 总结论 有没有值",
          "SELECT ISNULL(总结论,N'(空)') AS 总结论, COUNT(*) AS 单据数 FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 总结论");
      }
    }
  }
  static void q(Connection c,String t,String sql){System.out.println("=== "+t+" ===");
    try(Statement st=c.createStatement();ResultSet rs=st.executeQuery(sql)){
      ResultSetMetaData m=rs.getMetaData();
      for(int i=1;i<=m.getColumnCount();i++)System.out.print((i>1?" | ":"")+m.getColumnLabel(i));
      System.out.println();
      while(rs.next()){for(int i=1;i<=m.getColumnCount();i++)System.out.print((i>1?" | ":"")+rs.getString(i));System.out.println();}
    }catch(SQLException e){System.out.println("[ERR] "+e.getMessage());}System.out.println();}
}
