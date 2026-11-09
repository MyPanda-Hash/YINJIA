import java.sql.*;

/**
 * 只读:查一张单据头上的四个转ERP字段(验证「弃审清标记」闭环)。
 * 用法(在 tools 目录):java -cp lib\mssql-jdbc.jar archive\_erp-already-prompt-20261109\ErpDocStateProbe.java <库名> <单据编号>
 */
public class ErpDocStateProbe {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String docNo = a.length > 1 ? a[1] : "";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("== " + db + " / " + docNo);
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT h.单据编号, ISNULL(h.是否已转ERP,N'(null)') AS erp, ISNULL(h.ERP单号,N'(null)') AS erpno,"
                    + " ISNULL(h.转ERP操作人,N'(null)') AS op, ISNULL(CONVERT(nvarchar(30), h.转ERP时间),N'(null)') AS t,"
                    + " (SELECT TOP 1 CASE WHEN s.shr IS NULL THEN N'未审核' ELSE N'已审核' END FROM yj_doc_status s"
                    + "   WHERE s.panel_code=N'PURCHASE_IN' AND s.doc_no=h.单据编号) AS st"
                    + " FROM bd_purchase_in h WHERE h.单据编号 = ?")) {
                ps.setString(1, docNo);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) { System.out.println("  查不到该单据"); return; }
                    System.out.println("  单据编号=" + rs.getString(1));
                    System.out.println("  是否已转ERP=" + rs.getString("erp"));
                    System.out.println("  ERP单号=" + rs.getString("erpno"));
                    System.out.println("  转ERP操作人=" + rs.getString("op"));
                    System.out.println("  转ERP时间=" + rs.getString("t"));
                    System.out.println("  审核状态=" + rs.getString("st"));
                }
            }
        }
    }
}
