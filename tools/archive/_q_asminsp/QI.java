import java.sql.*;
public class QI {
  public static void main(String[] a) throws Exception {
    for (String db : new String[]{"HSDZ_MES","HSDZ_MES_TEST"}) {
      String url="jdbc:sqlserver://127.0.0.1:1433;databaseName="+db+";encrypt=false;trustServerCertificate=true";
      try (Connection c=DriverManager.getConnection(url,"yinjia","Yinjia@2026");
           Statement st=c.createStatement();
           ResultSet rs=st.executeQuery("SELECT TOP 8 h.单据编号, ISNULL(h.单据状态,N'') AS 状态, COUNT(d.id) AS 明细行,"
             + " SUM(CASE WHEN d.表区 IS NOT NULL AND d.表区<>N'' AND d.表区<>N'数量判定' THEN 1 ELSE 0 END) AS 项目行"
             + " FROM qc_asm_insp_head h LEFT JOIN qc_asm_insp_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'"
             + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' GROUP BY h.单据编号, h.单据状态 ORDER BY h.单据编号 DESC")) {
        System.out.println("### "+db);
        while (rs.next()) System.out.println("  "+rs.getString(1)+" | "+rs.getString(2)+" | 明细"+rs.getInt(3)+" | 项目行"+rs.getInt(4));
      }
    }
  }
}
