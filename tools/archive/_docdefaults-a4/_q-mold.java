import java.sql.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;

/** 只读:RD_MOLD_PROC 全部 header 字段(按 seq),看 315/415/435/465 四格在库里的邻居。 */
public class _q_mold {
  public static void main(String[] a) throws Exception {
    String db = a.length > 0 ? a[0] : "HSDZ_MES";
    StringBuilder sb = new StringBuilder("=== " + db + " RD_MOLD_PROC header (seq 300..500) ===\n");
    String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
        + ";encrypt=false;trustServerCertificate=true";
    try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
         Statement s = c.createStatement();
         ResultSet r = s.executeQuery(
             "SELECT seq,label,col_name,editable,visible,hidden FROM yj_field "
           + "WHERE panel_code='RD_MOLD_PROC' AND place='header' AND seq BETWEEN 300 AND 500 ORDER BY seq")) {
      while (r.next()) {
        sb.append(String.format("seq=%-5s | %-16s | col=%-16s | editable=%s visible=%s hidden=%s%n",
            r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6)));
      }
    }
    Files.writeString(Paths.get(a.length > 1 ? a[1] : "C:/INCER/YINJIA-MES/tools/archive/_docdefaults-a4/_q-mold.out.txt"),
        sb.toString(), StandardCharsets.UTF_8);
    System.out.println("written");
  }
}
