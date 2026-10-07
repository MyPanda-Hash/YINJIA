import java.sql.*;

/**
 * 一次性清理:测试库(HSDZ_MES_TEST)里被探针**填错列**的那一行
 * (2026-10-04 第一次跑 _v-custom-tab.cjs 时,探针按错的表头列序把 34.2 填进了「折数」)。
 * 只动测试库的演示数据;顺带把值挪到「炭棒直径」该在的备用列(按 yj_field.tab_key/label 定位)。
 * 用法:java -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/FixTestRow.java
 */
public class FixTestRow {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            String col = null;
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT col_name FROM yj_field WHERE panel_code='QC_INSP_REQ' AND label=N'炭棒直径'")) {
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) col = rs.getString(1); }
            }
            System.out.println("炭棒直径 的承载列 = " + col);
            if (col == null) { System.out.println("(该自定义字段不存在,无需清理)"); return; }
            String sql = "UPDATE qc_insp_req SET " + "[" + col + "] = N'34.2', [折数] = NULL "
                    + "WHERE 物料编号 = N'YJ-TEST-CUSTOM-002' AND ISNULL(asp_cancel,'N') <> 'Y' AND [折数] = N'34.2'";
            try (Statement st = c.createStatement()) {
                int n = st.executeUpdate(sql);
                System.out.println("已修正行数 = " + n);
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT id, 物料类别, 物料编号, 折数, [" + col + "] AS 炭棒直径 FROM qc_insp_req "
                         + "WHERE 物料编号 = N'YJ-TEST-CUSTOM-002' ORDER BY id")) {
                while (rs.next()) System.out.println("id=" + rs.getInt(1) + " " + rs.getString(2) + " " + rs.getString(3)
                        + " 折数=" + rs.getString(4) + " 炭棒直径=" + rs.getString(5));
            }
        }
    }
}
