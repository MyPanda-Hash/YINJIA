import java.sql.*;

/** 只读:特采单(QC_TC_IN)的明细/表头字段登记(它没有业务列,字段全落在 备用N 列上)。 */
public class Q {
    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection("jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10",
                "yinjia", "Yinjia@2026")) {
            System.out.println("== QC_TC_IN detail 字段 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT label,col_name,seq,visible,hidden,editable FROM yj_field "
                         + "WHERE panel_code='QC_TC_IN' AND place='detail' ORDER BY seq,id")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " → " + r.getString(2) + " seq=" + r.getInt(3)
                        + " vis=" + r.getInt(4) + " hid=" + r.getInt(5) + " edit=" + r.getInt(6));
            }
            System.out.println("== QC_TC_IN header 字段 ==");
            try (Statement s = c.createStatement();
                 ResultSet r = s.executeQuery("SELECT label,col_name,seq,visible FROM yj_field "
                         + "WHERE panel_code='QC_TC_IN' AND place='header' ORDER BY seq,id")) {
                while (r.next()) System.out.println("  " + r.getString(1) + " → " + r.getString(2) + " seq=" + r.getInt(3)
                        + " vis=" + r.getInt(4));
            }
        }
    }
}
