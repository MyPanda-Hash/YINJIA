import java.sql.*;

/**
 * 探针:核对 ego 实测提交的那张「扫码其他退料」单(测试库 TL-2026-11-0019)落的是不是现场选的仓。
 * 用法:  java ... _ProbeDoc.java HSDZ_MES_TEST TL-2026-11-0019
 */
public class _ProbeDoc {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
        String no = args.length > 1 ? args[1] : "TL-2026-11-0019";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=8";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
             Statement st = c.createStatement()) {
            System.out.println("== " + db + " 单据头 " + no + " ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT 单据编号, 单据日期, 业务类型, 单据状态, 备注, 领用人 FROM bd_material_ret WHERE 单据编号=N'" + no + "'")) {
                while (rs.next()) {
                    System.out.printf("  %s | %s | %s | %s | 备注=%s | 领用人=%s%n", rs.getString(1), rs.getString(2),
                        rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6));
                }
            }
            System.out.println("== 明细行 ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT 行号, 材料编码, 材料名称, 仓库, 仓库编码, 批号, 数量, 明细备注 FROM bl_material_ret "
                    + "WHERE 单据编号=N'" + no + "' ORDER BY 行号")) {
                while (rs.next()) {
                    System.out.printf("  行%s | %s %s | 仓库=[%s]%s | 批号=%s | 数量=%s | %s%n", rs.getString(1),
                        rs.getString(2), rs.getString(3), rs.getString(5), rs.getString(4), rs.getString(6),
                        rs.getBigDecimal(7), rs.getString(8));
                }
            }
            System.out.println("== 单据状态 ==");
            try (ResultSet rs = st.executeQuery(
                    "SELECT panel_code, doc_no, shr FROM yj_doc_status WHERE panel_code='MATERIAL_RET' AND doc_no=N'" + no + "'")) {
                while (rs.next()) {
                    System.out.printf("  %s | %s | shr=%s%n", rs.getString(1), rs.getString(2), rs.getString(3));
                }
            }
        } catch (SQLException e) {
            System.out.println("ERR " + e.getMessage());
        }
    }
}
