import java.sql.*;

/** 一次性探针:成品检验单明细里真实的「表区 / 检验项目 / 测量值」分布(定报表分组口径)。 */
public class QH {
    public static void main(String[] a) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
            try (Connection c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026")) {
                System.out.println("########## " + db + " ##########");
                q(c, "表区 分布",
                    "SELECT ISNULL(表区,N'(null)') AS 表区, COUNT(*) AS 行数 FROM dbo.qc_asm_insp_detail "
                  + "WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 表区 ORDER BY 表区");
                q(c, "明细(单据/表区/检验项目/测量值1..3/结果判断)",
                    "SELECT TOP 25 单据编号, ISNULL(表区,N'') AS 表区, ISNULL(检验项目,N'') AS 检验项目,"
                  + " 测量值1, 测量值2, 测量值3, ISNULL(结果判断,N'') AS 结果判断, ISNULL(处理方式,N'') AS 处理方式"
                  + " FROM dbo.qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号, id");
                q(c, "头表里报表要用的字段(抽检总量/检验时间 有没有)",
                    "SELECT COL_LENGTH(N'dbo.qc_asm_insp_head', N'抽检总量') AS 抽检总量列,"
                  + " COL_LENGTH(N'dbo.qc_asm_insp_head', N'检验时间') AS 检验时间列,"
                  + " COL_LENGTH(N'dbo.qc_asm_insp_head', N'检验数量') AS 检验数量列,"
                  + " COL_LENGTH(N'dbo.qc_asm_insp_head', N'检验日期') AS 检验日期列,"
                  + " COL_LENGTH(N'dbo.qc_asm_insp_head', N'客户名称') AS 客户名称列");
                q(c, "对照:制程检验单头表有这两个字段",
                    "SELECT COL_LENGTH(N'dbo.qc_proc_insp_head', N'抽检总量') AS 抽检总量列,"
                  + " COL_LENGTH(N'dbo.qc_proc_insp_head', N'检验时间') AS 检验时间列");
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
