import java.sql.*;

/** 只读:两张单的关联键实况 + 现有单据走到哪一步。 */
public class _Q6 {
    public static void main(String[] a) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true";
        try (Connection c = DriverManager.getConnection(url, "yinjia", pass)) {
            System.out.println("== " + db + " ==");
            q(c, "立项申请", "SELECT [单据编号] + ' | 文档编号=' + ISNULL([文档编号],'-') + ' | 机型=' + ISNULL([机型及应用位置],'-') + ' | 等级=' + ISNULL([项目等级],'-') + ' | 对接人=' + ISNULL([备用1],'-') + ' | 责任人=' + ISNULL([备用2],'-') + ' | 确认=' + ISNULL([备用3],'-') + ' | 确认时间=' + ISNULL([备用4],'-') + ' | 立项人=' + ISNULL([申请立项人],'-') FROM rd_approval WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY [单据编号]");
            q(c, "实施计划", "SELECT [单据编号] + ' | 文档编号=' + ISNULL([文档编号],'-') + ' | 项目=' + ISNULL([项目名称],'-') + ' | 负责人=' + ISNULL([负责人],'-') + ' | 定级=' + ISNULL([项目定级],'-') + ' | 阶段1=' + ISNULL([阶段1_计划内容],'-') + ' | 阶段1实际=' + ISNULL(CONVERT(varchar(19),[阶段1_实际完成],120),'-') FROM rd_plan WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY [单据编号]");
            q(c, "进度行", "SELECT [单据编号] + ' | 项目=' + ISNULL([项目名称],'-') + ' | 说明=' + ISNULL([说明],'-') + ' | 项目编号=' + ISNULL([项目编号],'-') + ' | 状态=' + ISNULL([状态],'-') + ' | 作废=' + ISNULL(asp_cancel,'N') FROM rd_progress_detail ORDER BY id");
            q(c, "审批留痕(RD 最近20)", "SELECT TOP 20 panel_code + ' ' + form_no + ' ' + action + '/' + result + ' by ' + ISNULL(operator,'-') + ' @' + ISNULL(CONVERT(varchar(19), created_at, 120),'-') FROM yj_form_approval WHERE panel_code IN ('RD_APPROVAL','RD_PLAN') ORDER BY id DESC");
        }
    }

    static void q(Connection c, String label, String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) System.out.println("  " + label + ": " + rs.getString(1));
        } catch (SQLException e) {
            System.out.println("  " + label + ": ERR " + e.getMessage());
        }
    }
}
