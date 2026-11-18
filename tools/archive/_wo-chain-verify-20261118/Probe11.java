import java.sql.*;
public class Probe11 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://localhost:1433;encrypt=false;trustServerCertificate=true;loginTimeout=10;databaseName=HSDZ_MES";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement s = c.createStatement();
             ResultSet r = s.executeQuery(
                 "SELECT id, plang_id, pl_no, ISNULL(pl_xc,0) 行号, ISNULL(scx,N'') 线,"
                 + " CONVERT(varchar(10), st_date,120) st, CONVERT(varchar(10), cp_date,120) cp,"
                 + " ISNULL(asp_cancel,'N') 作废 FROM dbo.plang_pc WHERE plang_id=2184")) {
            while (r.next()) System.out.printf("plang_pc id=%s 行号=%s 线=%s %s~%s 作废=%s%n",
                r.getString("id"), r.getString("行号"), r.getString("线"), r.getString("st"), r.getString("cp"), r.getString("作废"));
        }
    }
}
