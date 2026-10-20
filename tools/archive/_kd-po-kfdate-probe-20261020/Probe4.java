// Probe4.java — 只读:MES 里「生产日期」这个字段都长在哪些表、实际填了多少(给采购订单做对照)
import java.sql.*;

public class Probe4 {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static void q(Connection c, String title, String sql) {
        System.out.println("\n---- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            int n = 0;
            while (rs.next() && n++ < 40) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(i > 1 ? " | " : "").append(v == null ? "<null>" : v);
                }
                System.out.println("  " + row);
            }
            if (n == 0) System.out.println("  (no rows)");
        } catch (Exception e) {
            System.out.println("  ERR: " + e.getMessage());
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("DB=" + DB);
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            q(c, "A 哪些表物理上有「生产日期」列",
                "SELECT t.name AS 表, c.name AS 列, ty.name AS 类型 "
              + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
              + "WHERE c.name=N'生产日期' ORDER BY t.name");

            q(c, "B 采购入库单 bl_purchase_in.生产日期 填充情况",
                "SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(生产日期,N'')<>N'' THEN 1 ELSE 0 END) AS 生产日期非空 "
              + "FROM bl_purchase_in");

            q(c, "C 来料检验单 qc_insp_detail.生产日期 填充情况",
                "SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(生产日期,N'')<>N'' THEN 1 ELSE 0 END) AS 生产日期非空 "
              + "FROM qc_insp_detail");

            q(c, "D 销售订单 bl_so_order.生产日期 填充情况",
                "SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(生产日期,N'')<>N'' THEN 1 ELSE 0 END) AS 生产日期非空 "
              + "FROM bl_so_order");

            q(c, "E 首件检验单 qc_first_insp_head.生产日期 填充情况",
                "SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(生产日期,N'')<>N'' THEN 1 ELSE 0 END) AS 生产日期非空 "
              + "FROM qc_first_insp_head");
        }
    }
}
