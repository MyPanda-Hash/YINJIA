import java.sql.*;

/** 一次性探针:核对成品检验单(QC_ASM_INSP)字段与明细次序(迁移后)。 */
public class QD {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                System.out.println("########## " + db + " ##########");
                q(c, "明细列(可见,按 seq) —— 期望:检验项目|检验要求|检验方法|产线常规功能性结果|结果判断|检查频率|实测数值|测量值1..5|判定|数量|不合格数量|处理方式|备注",
                    "SELECT seq, col_name, data_type, width FROM yj_field WHERE panel_code=N'QC_ASM_INSP' "
                  + "AND place LIKE N'%detail%' AND visible=1 AND hidden=0 ORDER BY seq, id");
                q(c, "表头列(query,header/header 可见,按 seq)",
                    "SELECT seq, col_name FROM yj_field WHERE panel_code=N'QC_ASM_INSP' "
                  + "AND place LIKE N'%header%' AND visible=1 AND hidden=0 ORDER BY seq, id");
                q(c, "新增三列的物理列 + 注明",
                    "SELECT OBJECT_NAME(c.object_id) AS tbl, c.name, t.name AS typ, c.max_length, ep.value AS 注释 "
                  + "FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id "
                  + "LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
                  + "WHERE (c.object_id=OBJECT_ID('dbo.qc_asm_insp_head') AND c.name=N'客户名称') "
                  + "   OR (c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') AND c.name IN (N'产线常规功能性结果', N'结果判断'))");
                q(c, "译名(新增/复用)",
                    "SELECT ref_key, COUNT(*) AS 语言数, MAX(CASE WHEN locale='en' THEN text END) AS en FROM yj_translation "
                  + "WHERE scope=N'field' AND ref_key IN (N'客户名称', N'产线常规功能性结果', N'结果判断') GROUP BY ref_key");
                q(c, "表/行表列数",
                    "SELECT OBJECT_NAME(object_id) AS t, COUNT(*) AS n FROM sys.columns WHERE object_id IN "
                  + "(OBJECT_ID('dbo.qc_asm_insp_head'), OBJECT_ID('dbo.qc_asm_insp_detail')) GROUP BY OBJECT_NAME(object_id)");
                q(c, "明细可见列撞号检查(期望 0 行)",
                    "SELECT x.col_name AS a, y.col_name AS b, x.seq FROM yj_field x JOIN yj_field y "
                  + "ON y.panel_code=x.panel_code AND y.seq=x.seq AND y.id<>x.id "
                  + "WHERE x.panel_code=N'QC_ASM_INSP' AND x.visible=1 AND x.place LIKE N'%detail%' AND y.visible=1 AND y.place LIKE N'%detail%'");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            for (int i = 1; i <= n; i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            StringBuilder line = new StringBuilder();
            while (rs.next()) {
                StringBuilder sb = new StringBuilder();
                for (int i = 1; i <= n; i++) sb.append(i > 1 ? " | " : "").append(rs.getString(i));
                if (n == 2 && "col_name".equals(m.getColumnLabel(2))) line.append(sb.toString().split(" \\| ")[1]).append('|');
                else System.out.println(sb);
            }
            if (line.length() > 0) System.out.println("  → " + line);
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
