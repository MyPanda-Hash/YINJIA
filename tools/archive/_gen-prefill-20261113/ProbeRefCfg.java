import java.sql.*;

/**
 * 一次性取证(只读,第 5 版)—— 仓库/仓位档案面板 + 采购入库单「仓位」参照配置 + yj_field 列结构。
 * 运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_gen-prefill-20261113/ProbeRefCfg.java out.txt
 */
public class ProbeRefCfg {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10";
        StringBuilder sb = new StringBuilder();
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            sb.append("=== yj_field 列结构 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT c.name AS col, ty.name AS typ, c.max_length AS len FROM sys.columns c "
                         + "JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id")) {
                while (rs.next()) sb.append(rs.getString(1)).append(" (").append(rs.getString(2)).append(",").append(rs.getInt(3)).append(")\n");
            }
            sb.append("\n=== 仓库/仓位档案面板 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT panel_code, panel_name, head_table, line_table, mode FROM yj_panel "
                         + "WHERE panel_code IN ('WH','WHLOC','WAREHOUSE','BIN') OR panel_name LIKE N'%仓库%' OR panel_name LIKE N'%仓位%'")) {
                while (rs.next()) sb.append(rs.getString(1)).append(" | ").append(rs.getString(2)).append(" | ").append(rs.getString(3)).append(" | ").append(rs.getString(4)).append(" | ").append(rs.getString(5)).append('\n');
            }
            sb.append("\n=== PURCHASE_IN 的 仓库/仓位 字段完整配置 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT * FROM yj_field WHERE panel_code='PURCHASE_IN' AND (label IN (N'仓库',N'仓位',N'仓位编码') ) ORDER BY place, seq")) {
                ResultSetMetaData m = rs.getMetaData();
                while (rs.next()) {
                    StringBuilder row = new StringBuilder();
                    for (int i = 1; i <= m.getColumnCount(); i++) row.append(m.getColumnLabel(i)).append('=').append(rs.getString(i)).append(" ; ");
                    sb.append(row).append("\n\n");
                }
            }
            sb.append("\n=== PU_ORDER 的 仓库/仓位 字段完整配置 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT * FROM yj_field WHERE panel_code='PU_ORDER' AND (label LIKE N'%仓库%' OR label LIKE N'%仓位%') ORDER BY place, seq")) {
                ResultSetMetaData m = rs.getMetaData();
                while (rs.next()) {
                    StringBuilder row = new StringBuilder();
                    for (int i = 1; i <= m.getColumnCount(); i++) row.append(m.getColumnLabel(i)).append('=').append(rs.getString(i)).append(" ; ");
                    sb.append(row).append("\n\n");
                }
            }
            sb.append("\n=== WH 面板字段 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT label, col_name, place, seq, visible FROM yj_field WHERE panel_code='WH' ORDER BY place, seq")) {
                while (rs.next()) sb.append(rs.getString(1)).append(" | ").append(rs.getString(2)).append(" | ").append(rs.getString(3)).append(" | ").append(rs.getInt(4)).append(" | ").append(rs.getInt(5)).append('\n');
            }
            sb.append("\n=== WHLOC 面板字段 ===\n");
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT label, col_name, place, seq, visible FROM yj_field WHERE panel_code='WHLOC' ORDER BY place, seq")) {
                while (rs.next()) sb.append(rs.getString(1)).append(" | ").append(rs.getString(2)).append(" | ").append(rs.getString(3)).append(" | ").append(rs.getInt(4)).append(" | ").append(rs.getInt(5)).append('\n');
            }
        }
        String out = args.length > 0 ? args[0] : "probe-ref.txt";
        java.nio.file.Files.writeString(java.nio.file.Path.of(out), sb.toString());
        System.out.println("written: " + out);
    }
}
