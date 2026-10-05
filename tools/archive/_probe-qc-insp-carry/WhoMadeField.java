import java.sql.*;

/**
 * 一次性排查:正式库里那个 label=N'自定义字段' 的动态字段是谁、什么时候建的(以及是否被本次迁移搬过列)。
 * 只读。运行:java "-Dstdout.encoding=UTF-8" -cp tools/lib/mssql-jdbc.jar tools/archive/_probe-qc-insp-carry/WhoMadeField.java
 */
public class WhoMadeField {
    public static void main(String[] args) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
            System.out.println("\n=========== " + db + " ===========");
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                q(c, "QC_INSP_REQ 的动态字段(全字段)",
                        "SELECT id, col_name, label, label_en, tab_key, seq, width, data_type, place FROM yj_field "
                                + "WHERE panel_code='QC_INSP_REQ' AND col_name LIKE N'备用%' ORDER BY seq, id");
                q(c, "字段绑定审计表结构",
                        "SELECT name AS 列名, TYPE_NAME(user_type_id) AS 类型 FROM sys.columns WHERE object_id=OBJECT_ID('yj_ext_bind_log') ORDER BY column_id");
                q(c, "字段绑定审计(近 10 条,含操作人)",
                        "SELECT TOP 10 * FROM yj_ext_bind_log ORDER BY id DESC");
                q(c, "该字段是否已有数据(全表非空统计)",
                        "SELECT (SELECT COUNT(*) FROM qc_insp_req WHERE [备用141] IS NOT NULL) AS 备用141非空, "
                                + "(SELECT COUNT(*) FROM qc_insp_req WHERE [备用1] IS NOT NULL) AS 备用1非空, "
                                + "(SELECT COUNT(*) FROM qc_insp_req WHERE [备用2] IS NOT NULL) AS 备用2非空, "
                                + "(SELECT COUNT(*) FROM qc_insp_req WHERE [备用3] IS NOT NULL) AS 备用3非空");
                q(c, "各页签存活行数", "SELECT 物料类别, COUNT(*) AS 行数 FROM qc_insp_req WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料类别 ORDER BY 行数 DESC");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("-- " + title + " --");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) h.append(m.getColumnLabel(i)).append(i < m.getColumnCount() ? " | " : "");
            System.out.println(h);
            int n = 0;
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) sb.append(rs.getString(i)).append(i < m.getColumnCount() ? " | " : "");
                System.out.println(sb);
                n++;
            }
            if (n == 0) System.out.println("(0 行)");
        } catch (SQLException e) {
            System.out.println("[查询失败] " + e.getMessage());
        }
    }
}
