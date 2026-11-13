import java.sql.*;

/**
 * 一次性取证(只读,合单生单)—— 采购链各表里「采购订单号 / 采购单号 / 采购订单行号」相关列,
 * 以及 转ERP 依赖的源单列,用来定「合单后哪些行号是合单前(采购订单行号)、哪些是合单后(暂收行号)」。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_merge-gen-20261113/ProbeMergeCols.java out.txt
 */
public class ProbeMergeCols {
    public static void main(String[] a) throws Exception {
        StringBuilder sb = new StringBuilder();
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            for (String t : new String[]{"sl_recv", "sl_recv_detail", "qc_insp", "qc_insp_detail",
                    "qc_return", "qc_return_detail", "bd_purchase_in", "bl_purchase_in"}) {
                sb.append("\n=== ").append(t).append(" 含 采购/订单/行号/来源 的列 ===\n");
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("SELECT c.name AS col, ty.name AS typ, c.max_length AS len "
                             + "FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                             + "WHERE c.object_id=OBJECT_ID('" + t + "') AND (c.name LIKE N'%采购%' OR c.name LIKE N'%订单%' "
                             + "OR c.name LIKE N'%行号%' OR c.name LIKE N'%来源%' OR c.name LIKE N'%源单%' OR c.name LIKE N'%外部%') "
                             + "ORDER BY c.column_id")) {
                    int n = 0;
                    while (rs.next()) { sb.append("  ").append(rs.getString(1)).append(" (").append(rs.getString(2)).append(",").append(rs.getInt(3)).append(")\n"); n++; }
                    if (n == 0) sb.append("  (0 列)\n");
                }
            }
            sb.append("\n=== yj_field:四单里 采购单号/采购订单行号/来源单号 的登记 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT panel_code, label, col_name, place, seq, visible, hidden "
                         + "FROM yj_field WHERE panel_code IN (N'PU_ORDER',N'QC_RECV',N'QC_INSP',N'QC_RETURN',N'PURCHASE_IN') "
                         + "AND (label LIKE N'%采购单号%' OR label LIKE N'%采购订单号%' OR label LIKE N'%采购订单行号%' "
                         + "OR label LIKE N'%来源单据%' OR label LIKE N'%来源单号%' OR label LIKE N'%来源%') "
                         + "ORDER BY panel_code, place, seq")) {
                while (rs.next()) sb.append("  ").append(rs.getString(1)).append(" | ").append(rs.getString(2))
                        .append(" | col=").append(rs.getString(3)).append(" | ").append(rs.getString(4))
                        .append(" seq=").append(rs.getInt(5)).append(" vis=").append(rs.getInt(6)).append(" hid=").append(rs.getInt(7)).append('\n');
            }
            sb.append("\n=== sl_recv_detail 现存 采购单号/采购订单行号 有值行数 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) AS total, "
                         + "SUM(CASE WHEN ISNULL(LTRIM(RTRIM([采购单号])),'') <> '' THEN 1 ELSE 0 END) AS 有采购单号, "
                         + "SUM(CASE WHEN ISNULL(LTRIM(RTRIM([采购订单行号])),'') <> '' THEN 1 ELSE 0 END) AS 有订单行号 "
                         + "FROM sl_recv_detail")) {
                rs.next();
                sb.append("  total=").append(rs.getInt(1)).append(" 有采购单号=").append(rs.getInt(2)).append(" 有订单行号=").append(rs.getInt(3)).append('\n');
            }
        }
        String out = a.length > 0 ? a[0] : "probe-merge.txt";
        java.nio.file.Files.writeString(java.nio.file.Path.of(out), sb.toString());
        System.out.println("written: " + out);
    }
}
