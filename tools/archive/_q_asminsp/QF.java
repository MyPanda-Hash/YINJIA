import java.sql.*;

/** 一次性探针:改名/重排后的成品检验单明细列与数据守恒核对。 */
public class QF {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                System.out.println("########## " + db + " ##########");
                q(c, "明细可见列(按 seq)—— 期望:检验项目|检验要求|检验方法|实测数值|测量值1..5|检查频率|数量|不合格数量|处理方式|备注|产线常规功能性结果|结果判断",
                    "SELECT seq, col_name, data_type, width FROM yj_field WHERE panel_code=N'QC_ASM_INSP' "
                  + "AND place LIKE N'%detail%' AND visible=1 AND hidden=0 ORDER BY seq, id");
                q(c, "列名核对:结果判断 在 / 判定 不在",
                    "SELECT COL_LENGTH(N'dbo.qc_asm_insp_detail', N'结果判断') AS 结果判断列, "
                  + "COL_LENGTH(N'dbo.qc_asm_insp_detail', N'判定') AS 判定列, "
                  + "COL_LENGTH(N'dbo.qc_asm_insp_detail', N'产线常规功能性结果') AS 产线常规功能性结果列");
                q(c, "数据守恒:总行数 / 结果判断有值 / 取值分布",
                    "SELECT (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail) AS 总行数,"
                  + " (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail WHERE 结果判断 IS NOT NULL) AS 结果判断有值,"
                  + " (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail WHERE 结果判断 = N'合格') AS 合格,"
                  + " (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail WHERE 结果判断 = N'不合格') AS 不合格");
                q(c, "列级注明",
                    "SELECT c.name, ep.value AS 注释 FROM sys.columns c LEFT JOIN sys.extended_properties ep "
                  + "ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name=N'MS_Description' "
                  + "WHERE c.object_id=OBJECT_ID('dbo.qc_asm_insp_detail') AND c.name IN (N'结果判断', N'产线常规功能性结果')");
                q(c, "明细可见列撞号(期望 0 行)",
                    "SELECT x.col_name AS a, y.col_name AS b, x.seq FROM yj_field x JOIN yj_field y "
                  + "ON y.panel_code=x.panel_code AND y.seq=x.seq AND y.id<>x.id "
                  + "WHERE x.panel_code=N'QC_ASM_INSP' AND x.visible=1 AND x.place LIKE N'%detail%' AND y.visible=1 AND y.place LIKE N'%detail%'");
                q(c, "其它三张检验单的 判定 应保持原名",
                    "SELECT panel_code, col_name, place FROM yj_field WHERE panel_code IN (N'QC_MOLD_INSP', N'QC_CUT_INSP', N'QC_PROC_INSP') "
                  + "AND col_name IN (N'判定', N'结果判断') ORDER BY panel_code, col_name");
            }
        }
    }

    private static void q(Connection c, String title, String sql) {
        System.out.println("=== " + title + " ===");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + m.getColumnLabel(i));
            System.out.println();
            while (rs.next()) {
                for (int i = 1; i <= m.getColumnCount(); i++) System.out.print((i > 1 ? " | " : "") + rs.getString(i));
                System.out.println();
            }
        } catch (SQLException e) {
            System.out.println("[ERR] " + e.getMessage());
        }
        System.out.println();
    }
}
