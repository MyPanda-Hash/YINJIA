import java.sql.*;

/**
 * 一次性排障/设计取证:来料检验要求 qc_insp_req 的
 *   ① 物理列(含备用列池 备用1..20 是否就位)
 *   ② yj_field 登记的字段(place/seq/width/visible/hidden/dict_sql) —— 页签列是否可改由元数据驱动
 *   ③ 该面板的按钮/入口(字段管理能不能进)
 * 只读。运行(仓库根):java -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/QcReqMeta.java [库名]
 */
public class QcReqMeta {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
            System.out.println("=== 库 " + db + " ===");
            q(c, "qc_insp_req 列数/备用列数",
                    "SELECT COUNT(*) AS 总列数, SUM(CASE WHEN name LIKE N'备用%' THEN 1 ELSE 0 END) AS 备用列数 "
                            + "FROM sys.columns WHERE object_id = OBJECT_ID('qc_insp_req')");
            q(c, "备用列(前 5 个)及注明",
                    "SELECT TOP 5 c.name AS 列, CAST(ep.value AS nvarchar(200)) AS 注明 FROM sys.columns c "
                            + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description' "
                            + "WHERE c.object_id=OBJECT_ID('qc_insp_req') AND c.name LIKE N'备用%' ORDER BY c.column_id");
            q(c, "yj_field(QC_INSP_REQ 字段登记,按 seq)",
                    "SELECT id, col_name, label, data_type, place, seq, width, visible, hidden, editable, "
                            + "LEFT(ISNULL(dict_sql,''), 60) AS dict_sql FROM yj_field WHERE panel_code='QC_INSP_REQ' ORDER BY seq, id");
            q(c, "yj_field 里是否有绑定到备用列的动态字段(qc_ 前缀各表)",
                    "SELECT TOP 20 panel_code, col_name, label, data_type FROM yj_field "
                            + "WHERE col_name LIKE N'备用%' ORDER BY panel_code, seq");
            q(c, "面板 config / 按钮相关",
                    "SELECT panel_code, mode, detail_key, LEFT(ISNULL(config,''), 200) AS config FROM yj_panel WHERE panel_code='QC_INSP_REQ'");
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("\n-- " + title + " --");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(head);
            int n = 0;
            while (rs.next()) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(v == null ? "(null)" : v).append(i < m.getColumnCount() ? " | " : "");
                }
                System.out.println(row);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
