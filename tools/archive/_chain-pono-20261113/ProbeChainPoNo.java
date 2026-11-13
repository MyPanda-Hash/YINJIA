import java.sql.*;

/**
 * 一次性取证(只读):采购全链(订单→暂收→检验→退回/退料→特采→采购入库)每张单**明细行**上
 * 「采购订单号 / 采购单号 / 采购订单行号 / 源单编号」这几列的现状 —— 列是否存在、yj_field 是否登记、可见性、
 * 以及存量有值行数(判断"现在到底哪几站会丢订单号")。
 *
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_chain-pono-20261113/ProbeChainPoNo.java out.txt
 */
public class ProbeChainPoNo {
    public static void main(String[] a) throws Exception {
        StringBuilder sb = new StringBuilder();
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            // 面板 → 明细表
            String[][] panels = {
                    {"QC_RECV", "sl_recv_detail"}, {"QC_INSP", "qc_insp_detail"},
                    {"QC_RETURN", "qc_return_detail"}, {"QC_TC_IN", "qc_tc_in_detail"},
                    {"PURCHASE_IN", "bl_purchase_in"}
            };
            for (String[] p : panels) {
                String code = p[0], table = p[1];
                sb.append("\n=== ").append(code).append(" / ").append(table).append(" ===\n");
                // 明细里与「订单号」相关的列
                sb.append("  列:");
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('" + table + "') "
                             + "AND (c.name LIKE N'%采购%' OR c.name LIKE N'%订单%' OR c.name LIKE N'%源单%') ORDER BY c.column_id")) {
                    while (rs.next()) sb.append(' ').append(rs.getString(1));
                }
                sb.append('\n');
                // yj_field 登记(detail)
                try (Statement st = c.createStatement();
                     ResultSet rs = st.executeQuery("SELECT label, col_name, seq, visible, hidden, editable FROM yj_field "
                             + "WHERE panel_code = N'" + code + "' AND place = N'detail' AND (label LIKE N'%采购%' OR col_name LIKE N'%采购%' "
                             + "OR label LIKE N'%源单%' OR col_name LIKE N'%源单%') ORDER BY seq")) {
                    while (rs.next()) {
                        sb.append("  field: ").append(rs.getString(1)).append(" → ").append(rs.getString(2))
                                .append(" seq=").append(rs.getInt(3)).append(" vis=").append(rs.getInt(4))
                                .append(" hid=").append(rs.getInt(5)).append(" edit=").append(rs.getInt(6)).append('\n');
                    }
                }
                // 存量有值行数
                for (String col : new String[]{"采购单号", "采购订单行号", "源单编号", "采购订单号"}) {
                    try (Statement st = c.createStatement();
                         ResultSet rs = st.executeQuery("SELECT COL_LENGTH('" + table + "', N'" + col + "')")) {
                        rs.next();
                        if (rs.getObject(1) == null) { sb.append("  数据: ").append(col).append(" (无此列)\n"); continue; }
                    }
                    try (Statement st = c.createStatement();
                         ResultSet rs = st.executeQuery("SELECT COUNT(*) total, SUM(CASE WHEN ISNULL(LTRIM(RTRIM([" + col + "])),'')<>'' THEN 1 ELSE 0 END) has "
                                 + "FROM " + table)) {
                        rs.next();
                        sb.append("  数据: ").append(col).append(" 有值 ").append(rs.getInt(2)).append(" / 总 ").append(rs.getInt(1)).append('\n');
                    }
                }
            }
            sb.append("\n=== 特采单 QC_TC_IN 明细表结构(全部列) ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT c.name, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
                         + "WHERE c.object_id=OBJECT_ID('qc_tc_in_detail') ORDER BY c.column_id")) {
                while (rs.next()) sb.append("  ").append(rs.getString(1)).append(" (").append(rs.getString(2)).append(")\n");
            }
        }
        String out = a.length > 0 ? a[0] : "probe-chain-pono.txt";
        java.nio.file.Files.writeString(java.nio.file.Path.of(out), sb.toString());
        System.out.println("written: " + out);
    }
}
