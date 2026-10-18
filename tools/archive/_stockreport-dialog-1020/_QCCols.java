import java.sql.*;

/**
 * 查 qc_insp_detail 是否缺「品质复核人」列(两账套),用于定位失败的迁移
 * migrate-qc-insp-realize-20261018.sql(2026-10-20 启动时 [SQL失败] 列名 '品质复核人' 无效)。
 *
 * 用法: cd tools && java -cp lib\mssql-jdbc.jar archive\_stockreport-dialog-1020\_QCCols.java
 */
public class _QCCols {
    public static void main(String[] a) throws Exception {
        String pw = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            try (Connection c = DriverManager.getConnection(
                    "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";user=yinjia;password=" + pw
                            + ";encrypt=false;trustServerCertificate=true")) {
                StringBuilder sb = new StringBuilder();
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail' ORDER BY ORDINAL_POSITION")) {
                    while (rs.next()) sb.append(rs.getString(1)).append(",");
                }
                String cols = sb.toString();
                System.out.println("[" + db + "] qc_insp_detail 列数=" + (cols.isEmpty() ? 0 : cols.split(",").length)
                        + " 含「品质复核人」=" + cols.contains("品质复核人"));
                System.out.println("   列: " + (cols.length() > 260 ? cols.substring(0, 260) + "..." : cols));
                StringBuilder h = new StringBuilder();
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_head' "
                                + "AND COLUMN_NAME LIKE N'%复核%'")) {
                    while (rs.next()) h.append(rs.getString(1)).append(",");
                }
                System.out.println("   qc_insp_head 复核相关列: " + (h.length() == 0 ? "(无)" : h.toString()));
            } catch (Exception e) {
                System.out.println("[" + db + "] ERR " + e.getMessage());
            }
        }
    }
}
