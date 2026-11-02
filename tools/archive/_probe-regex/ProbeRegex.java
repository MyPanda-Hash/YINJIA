import java.sql.*;
import java.util.regex.*;

public class ProbeRegex {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false";
        String pass = System.getenv("YINJIA_SQL_PASS");
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            PreparedStatement ps = c.prepareStatement(
                "SELECT TOP 3 单据编号, 材料编码, ISNULL(明细备注,N'') AS note FROM bl_material_out " +
                "WHERE 单据编号 = ? ORDER BY 行号");
            ps.setString(1, a[0]);
            ResultSet rs = ps.executeQuery();
            Pattern p = Pattern.compile("需求\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\)");
            while (rs.next()) {
                String note = rs.getString("note");
                Matcher m = p.matcher(note);
                System.out.println(rs.getString("材料编码") + " | len=" + note.length()
                    + " | match=" + m.find() + (m.reset().find() ? " val=" + m.group(1) : "")
                    + "\n    note=[" + note + "]");
            }
        }
    }
}
