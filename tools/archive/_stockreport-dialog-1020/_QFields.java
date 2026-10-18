import java.sql.*;

/**
 * _QFields.java — 库存台账/收发存汇总 的 yj_field 元数据快照(排查查询弹窗字段重复用)。
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QFields.java HSDZ_MES
 */
public class _QFields {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                        + ";encrypt=false;trustServerCertificate=true")) {
            String sql = "SELECT f.id, f.panel_code, f.col_name, f.label, f.data_type, f.place, f.seq, f.visible, f.hidden, "
                    + "ISNULL(f.ref_panel,''), ISNULL(f.ref_field,'') "
                    + "FROM yj_field f WHERE f.panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY') ORDER BY f.panel_code, f.seq, f.id";
            try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
                System.out.println("id\tpanel\tcol\tdisplay\ttype\tplace\tseq\tvisible\thidden\trefPanel\trefField");
                while (rs.next()) {
                    System.out.println(String.join("\t", rs.getString(1), rs.getString(2), rs.getString(3),
                            rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8),
                            rs.getString(9), rs.getString(10), rs.getString(11)));
                }
            }
        }
    }
}

