import java.sql.*;

/** 只读:材料码单头是否记了来源打印单号(核对"只能打一次"是否落库)。 */
public class U14 {
    public static void main(String[] a) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("--- bd_pu_label 最近 12 张 ---");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT TOP 12 [单据编号],[采购订单号],[批次号],[来源打印单号],"
                     + " ISNULL(asp_cancel,'N') AS c, CONVERT(varchar(19),[asp_time1],120) AS t"
                     + " FROM bd_pu_label ORDER BY id DESC")) {
                while (rs.next()) System.out.println(rs.getString(1) + " 订单=" + rs.getString(2)
                    + " 批次=" + rs.getString(3) + " 来源=" + rs.getString(4) + " cancel=" + rs.getString(5) + " t=" + rs.getString(6));
            }
            System.out.println("--- MP-2026-11-0020 是否存在 ---");
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT [单据编号],[采购订单号],[打印版式],[数量合计] FROM bd_pu_print WHERE [单据编号]=?")) {
                ps.setString(1, "MP-2026-11-0020");
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) System.out.println(rs.getString(1) + " " + rs.getString(2) + " " + rs.getString(3) + " 数量=" + rs.getBigDecimal(4));
                }
            }
        }
    }
}
