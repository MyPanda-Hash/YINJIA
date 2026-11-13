import java.sql.*;

/**
 * 一次性取证(只读,第 4 版)—— 采购链**全部**表的 仓库/仓位 列(输出写文件,避免控制台截断)。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_gen-prefill-20261113/ProbeChain.java out.txt
 */
public class ProbeChain {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            String[] tables = {"bl_pu_order", "sl_recv", "sl_recv_detail", "qc_insp", "qc_insp_detail",
                    "qc_return", "qc_return_detail", "bl_purchase_in", "bd_purchase_in"};
            for (String t : tables) {
                sb.append("\n=== ").append(t).append(" ===\n");
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT c.name AS col, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                                     + "WHERE c.object_id = OBJECT_ID('" + t + "') ORDER BY c.column_id")) {
                    while (rs.next()) sb.append(rs.getString(1)).append(" (").append(rs.getString(2)).append(")\n");
                } catch (SQLException e) {
                    sb.append("[读取失败] ").append(e.getMessage()).append('\n');
                }
            }
            sb.append("\n=== 采购订单行 仓库非空行数 / 总行数 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) AS total, COUNT(NULLIF(LTRIM(RTRIM([仓库])), '')) AS haswh FROM bl_pu_order")) {
                rs.next();
                sb.append("total=").append(rs.getInt(1)).append(" 仓库有值=").append(rs.getInt(2)).append('\n');
            }
            sb.append("\n=== 采购入库单行 仓库/仓位 有值行数 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) AS total FROM bl_purchase_in")) {
                rs.next();
                sb.append("bl_purchase_in total=").append(rs.getInt(1)).append('\n');
            }
        }
        String out = args.length > 0 ? args[0] : "probe-chain.txt";
        java.nio.file.Files.writeString(java.nio.file.Path.of(out), sb.toString());
        System.out.println("written: " + out);
    }
}
