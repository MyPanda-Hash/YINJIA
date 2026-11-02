import java.sql.*;
public class _Q {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    try (Connection c = DriverManager.getConnection(url, "yinjia", System.getenv().getOrDefault("YINJIA_SQL_PASS","Yinjia@2026"))) {
      System.out.println("== " + db + " ==");
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT panel_code,panel_name,category,mode,line_table,date_col,page_size,config FROM yj_panel WHERE panel_code='WO_COMPLETION_LIST'")) {
        while (r.next()) System.out.printf("panel=%s name=%s cat=%s mode=%s line=%s date_col=%s page=%s config=%s%n",
          r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getObject(7),r.getString(8));
      }
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT TOP 30 id, [报工单号], gldh, gxdm, wgsj, [完工时间] FROM (SELECT s.id,s.[报工单号],s.gldh,s.gxdm,s.wgsj, CONVERT(nvarchar(30),s.wgsj,120) AS [完工时间] FROM scjl s WHERE RTRIM(s.wgzt)=N'Y' AND ISNULL(s.asp_cancel,N'N')<>N'Y') v ORDER BY id DESC")) {
        while (r.next()) System.out.printf("id=%s no=%s wo=%s gx=%s wgsj=%s txt=%s%n",
          r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6));
      }
      try (Statement s = c.createStatement();
           ResultSet r = s.executeQuery("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.v_wo_completion_detail') ORDER BY column_id")) {
        StringBuilder sb = new StringBuilder("view cols: ");
        while (r.next()) sb.append(r.getString(1)).append(" | ");
        System.out.println(sb);
      }
    }
  }
}
