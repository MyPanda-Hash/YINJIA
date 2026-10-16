import java.sql.*;
public class QJ {
  public static void main(String[] a) throws Exception {
    String url="jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true";
    try (Connection c=DriverManager.getConnection(url,"yinjia","Yinjia@2026");
         Statement st=c.createStatement();
         ResultSet rs=st.executeQuery("SELECT id, col_name, place, seq, visible, hidden, tab_key FROM yj_field WHERE panel_code=N'QC_ASM_INSP' AND (place LIKE N'%detail%') ORDER BY seq, id")) {
      while (rs.next()) System.out.println(rs.getInt(1)+" | "+rs.getString(2)+" | "+rs.getString(3)+" | seq="+rs.getInt(4)+" | vis="+rs.getInt(5)+" hid="+rs.getInt(6)+" | tab="+rs.getString(7));
    }
  }
}
