import java.sql.*;
public class QL {
  public static void main(String[] a) throws Exception {
    String url="jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
    try (Connection c=DriverManager.getConnection(url,"yinjia","Yinjia@2026");
         Statement st=c.createStatement()) {
      System.out.println("=== 面板 config(看有没有可复用的 JSON 扩展位) ===");
      try (ResultSet rs=st.executeQuery("SELECT panel_code, ISNULL(config,N'(null)') AS config, detail_key, mode FROM yj_panel WHERE panel_code IN (N'QC_ASM_INSP',N'QC_PROC_INSP',N'QC_INSP_REQ')")) {
        while(rs.next()) System.out.println(rs.getString(1)+" | "+rs.getString(3)+" | "+rs.getString(4)+" | config="+rs.getString(2));
      }
      System.out.println("\n=== 成品检验单明细里可装「无异常」这类定性值的列(文本类) ===");
      try (ResultSet rs=st.executeQuery("SELECT c.name, t.name AS typ, c.max_length, ISNULL(ep.value,N'') AS 注释 FROM sys.columns c "
        + "JOIN sys.types t ON t.user_type_id=c.user_type_id LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
        + "WHERE c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') AND t.name IN (N'nvarchar',N'varchar') ORDER BY c.column_id")) {
        while(rs.next()) System.out.println("  "+rs.getString(1)+" ("+rs.getString(2)+" "+rs.getInt(3)+") "+rs.getString(4).substring(0, Math.min(40, rs.getString(4).length())));
      }
      System.out.println("\n=== 出货检验计划里 C-84-02 的项目(表区/项目名) ===");
      try (ResultSet rs=st.executeQuery("SELECT 序号, 检验内容, 控制项目 FROM rd_insp_plan_detail d JOIN rd_insp_plan_head h ON h.单据编号=d.单据编号 WHERE h.产品编号=N'C-84-02' ORDER BY TRY_CAST(序号 AS int)")) {
        while(rs.next()) System.out.println("  序号="+rs.getString(1)+" | 检验内容(→表区)="+rs.getString(2)+" | 控制项目(→检验项目)="+rs.getString(3));
      }
    }
  }
}
