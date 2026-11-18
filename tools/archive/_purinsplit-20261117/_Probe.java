import java.sql.*;

/** 一次性探针:把 bl_purchase_in 一行的列名/类型/Java 类打出来(排查 varbinary→datetime2 隐式转换) */
public class _Probe {
    public static void main(String[] a) throws Exception {
        String db = a.length > 0 ? a[0] : "HSDZ_MES_TEST";
        long id = a.length > 1 ? Long.parseLong(a[1]) : 1241;
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             PreparedStatement ps = c.prepareStatement("SELECT * FROM bl_purchase_in WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                if (!rs.next()) { System.out.println("no row"); return; }
                for (int i = 1; i <= md.getColumnCount(); i++) {
                    Object v = rs.getObject(i);
                    String vc = v == null ? "null" : v.getClass().getSimpleName();
                    System.out.println(md.getColumnName(i) + " | " + md.getColumnTypeName(i) + " | " + vc
                            + " | " + (v instanceof byte[] b ? ("bytes:" + b.length) : String.valueOf(v)));
                }
            }
        }
    }
}
