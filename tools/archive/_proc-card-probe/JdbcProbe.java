import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 工序流程追踪卡后端 · JDBC 参数绑定探针(2026-10-29)。
 *
 * <p>为什么要有这一步:{@code ProcCardService} 的 SQL 里有两类**只有 JDBC 层才暴露**的写法 ——
 * ① 动态 IN 占位符(卡id/工序行id 列表);② 分页 {@code OFFSET ? ROWS FETCH NEXT ? ROWS ONLY}。
 * 这些在 SqlRunner 里跑通不代表 PreparedStatement 绑定能跑通。本探针用**与 service 完全一致的
 * SQL 文本**做一次 prepared 执行,并在测试账套里试插卡(事务内,结束回滚)。
 *
 * 用法:java -cp lib/mssql-jdbc.jar JdbcProbe.java <jdbcUrl> <user> <pass>
 */
public class JdbcProbe {

    static final String ROW_BATCH_APPLY = " CROSS APPLY (SELECT COALESCE("
            + " NULLIF(LTRIM(RTRIM(p.[批次号])), N''),"
            + " (SELECT TOP 1 NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') FROM dbo.plang_pc pc"
            + "   WHERE pc.plang_id = p.id AND ISNULL(pc.asp_cancel,'N') <> 'Y'"
            + "     AND NULLIF(LTRIM(RTRIM(pc.[批次号])), N'') IS NOT NULL ORDER BY pc.id DESC),"
            + " (SELECT TOP 1 NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') FROM dbo.scjl s2"
            + "   JOIN dbo.plang_pc pc2 ON pc2.id = s2.gd_id"
            + "   WHERE pc2.plang_id = p.id AND ISNULL(s2.asp_cancel,'N') <> 'Y'"
            + "     AND NULLIF(LTRIM(RTRIM(s2.[批次号])), N'') IS NOT NULL ORDER BY s2.id DESC))"
            + " AS 生产批次) bx";
    static final String ROW_BATCH = "COALESCE(bx.生产批次, CONVERT(varchar(8), p.pl_date, 112))";
    static final String ROW_BATCH_SOURCE =
            "CASE WHEN bx.生产批次 IS NOT NULL THEN N'生产批次' ELSE N'工单日期' END";
    static final String ROW_BATCH_ANCHOR = "ISNULL(p.[批次号],N'')";
    static final String HEAD_SELECT = "SELECT c.id AS 卡id, c.卡号, c.大批次号, c.小批次号,"
            + " ISNULL(c.批次来源,N'') AS 批次来源, c.工单号, c.工单行号, c.工单行id,"
            + " ISNULL(c.产品编码,N'') AS 产品编码, ISNULL(c.产品名称,N'') AS 产品名称,"
            + " ISNULL(c.规格型号,N'') AS 规格型号, CONVERT(float, ISNULL(c.计划数量,0)) AS 计划数量,"
            + " ISNULL(c.生产线,N'') AS 生产线, ISNULL(c.工艺路线,N'') AS 工艺路线,"
            + " ISNULL(c.卡状态,N'录入中') AS 卡状态, ISNULL(c.确认人,N'') AS 确认人,"
            + " CONVERT(varchar(19), c.确认时间, 120) AS 确认时间, ISNULL(c.备注,N'') AS 备注,"
            + " ISNULL(c.asp_user1,N'') AS 创建人, CONVERT(varchar(19), c.asp_time1, 120) AS 创建时间,"
            + " CONVERT(varchar(19), c.asp_time2, 120) AS 更新时间, ISNULL(p.[批次号],N'') AS 报工批次"
            + " FROM dbo.wo_proc_card_head c LEFT JOIN dbo.plang p ON p.id = c.工单行id";

    public static void main(String[] args) throws Exception {
        String url = args[0], user = args[1], pass = args[2];
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[connected] " + c.getMetaData().getDatabaseProductName()
                    + " / " + c.getMetaData().getURL());
            batches(c);
            lines(c);
            listPaged(c);
            photosIn(c);
            opAggsIn(c);
            if (c.getMetaData().getURL().contains("TEST")) writeTest(c);
            else System.out.println("[skip] 写探针只在测试账套执行");
        }
        System.out.println("[DONE]");
    }

    /** batches:关键字参数 + 派生表包一层(与 service 同 SQL) */
    static void batches(Connection c) throws SQLException {
        String sql = "SELECT t.批次号, t.批次来源, t.行数, t.卡数, t.产品数, t.计划数量 FROM ("
                + " SELECT " + ROW_BATCH + " AS 批次号, " + ROW_BATCH_SOURCE + " AS 批次来源,"
                + "   COUNT(*) AS 行数, COUNT(DISTINCT cx.id) AS 卡数,"
                + "   COUNT(DISTINCT NULLIF(ISNULL(p.dm,N''),N'')) AS 产品数,"
                + "   ISNULL(SUM(ISNULL(p.pl_sl,0)),0) AS 计划数量"
                + " FROM dbo.plang p" + ROW_BATCH_APPLY
                + " LEFT JOIN dbo.wo_proc_card_head cx ON cx.工单行id = p.id AND ISNULL(cx.asp_cancel,'N')<>'Y'"
                + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(" + ROW_BATCH + ",N'')<>N''"
                + "   AND p.pl_date >= ? AND p.pl_date < ?"
                + " GROUP BY " + ROW_BATCH + ", " + ROW_BATCH_SOURCE
                + ") t WHERE t.批次号 LIKE ? ORDER BY t.批次号 DESC";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setDate(1, java.sql.Date.valueOf("2026-09-01"));
            ps.setDate(2, java.sql.Date.valueOf("2026-11-01"));
            ps.setString(3, "%2026%");
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next() && n < 5) {
                    System.out.println("[batches] " + rs.getString(1) + " | 来源=" + rs.getString(2)
                            + " | 行数=" + rs.getInt(3) + " 卡数=" + rs.getInt(4)
                            + " 产品数=" + rs.getInt(5) + " 计划=" + rs.getDouble(6));
                    n++;
                }
                System.out.println("[batches] 前 5 行已打印,读取成功");
            }
        }
    }

    /** lines:批次数值 + 4 个 LIKE 参数 */
    static void lines(Connection c) throws SQLException {
        String sql = "SELECT p.id AS 工单行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                + " ISNULL(p.dm,N'') AS 产品编码, CONVERT(float, ISNULL(p.pl_sl,0)) AS 计划数量,"
                + " ISNULL(c.卡号,N'') AS 卡号, ISNULL(c.卡状态,N'') AS 卡状态"
                + " FROM dbo.plang p" + ROW_BATCH_APPLY
                + " LEFT JOIN dbo.wo_proc_card_head c ON c.工单行id = p.id AND ISNULL(c.asp_cancel,'N')<>'Y'"
                + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND " + ROW_BATCH + " = ?"
                + "   AND (p.pl_no LIKE ? OR ISNULL(p.dm,N'') LIKE ? OR ISNULL(p.mc,N'') LIKE ?"
                + "        OR ISNULL(p.gg,N'') LIKE ?)"
                + " ORDER BY p.pl_no, ISNULL(p.pl_xc,0), p.id";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, "20261019");
            for (int i = 2; i <= 5; i++) ps.setString(i, "%GD-2026-10-0223%");
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) {
                    System.out.println("[lines] 行id=" + rs.getLong(1) + " 工单=" + rs.getString(2)
                            + " 行号=" + rs.getInt(3) + " 产品=" + rs.getString(4)
                            + " 计划=" + rs.getDouble(5) + " 卡号=[" + rs.getString(6) + "]");
                    n++;
                }
                System.out.println("[lines] 命中 " + n + " 行(参数绑定 OK)");
            }
        }
    }

    /** list 分页:OFFSET ? ROWS FETCH NEXT ? ROWS ONLY + 5 个 LIKE/等值参数 */
    static void listPaged(Connection c) throws SQLException {
        String sql = HEAD_SELECT + " WHERE ISNULL(c.asp_cancel,'N')<>'Y'"
                + " AND ISNULL(c.产品编码,N'') LIKE ? AND ISNULL(c.卡状态,N'')=?"
                + " AND c.asp_time1 >= ? AND c.asp_time1 < ?"
                + " ORDER BY c.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, "%");
            ps.setString(2, "录入中");
            ps.setDate(3, java.sql.Date.valueOf("2026-01-01"));
            ps.setDate(4, java.sql.Date.valueOf("2027-01-01"));
            ps.setInt(5, 0);
            ps.setInt(6, 50);
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) n++;
                System.out.println("[list] OFFSET/FETCH 参数绑定 OK,返回 " + n + " 行");
            }
        }
    }

    /** 照片计数:动态 IN 占位符 */
    static void photosIn(Connection c) throws SQLException {
        String sql = "SELECT doc_no AS 卡号, ISNULL(field_key,N'') AS 字段键, COUNT(*) AS 张数"
                + " FROM dbo.yj_attachment WHERE panel_code=? AND doc_no IN (?)"
                + " GROUP BY doc_no, field_key";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, "PROC_FLOW_CARD");
            ps.setString(2, "LZK-TEST");
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) n++;
                System.out.println("[photos] IN 占位符绑定 OK,返回 " + n + " 组");
            }
        }
    }

    /** 行级报工聚合:IN + 锚点兜底(与 service 同 SQL) */
    static void opAggsIn(Connection c) throws SQLException {
        String sql = "SELECT a.工单行id AS 行id, s.gxdm AS 工序,"
                + " SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 已报工,"
                + " SUM(CASE WHEN ISNULL(s.wgzt,'N')<>'Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 待审核,"
                + " CONVERT(varchar(19), MAX(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN s.wgsj END),120) AS 完成时间,"
                + " COUNT(*) AS 报工单数"
                + " FROM (SELECT p.id AS 工单行id, p.pl_no, " + ROW_BATCH + " AS 批次号, "
                + ROW_BATCH_ANCHOR + " AS 报工批次"
                + "       FROM dbo.plang p" + ROW_BATCH_APPLY
                + "       WHERE p.id IN (?,?)) a"
                + " JOIN dbo.scjl s ON s.gldh=a.pl_no AND ISNULL(s.asp_cancel,'N')<>'Y'"
                + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pca WHERE pca.id=s.gd_id AND pca.plang_id=a.工单行id)"
                + "        OR (ISNULL(s.gd_id,0)=0 AND (ISNULL(s.[批次号],N'')=ISNULL(a.报工批次,N'')"
                + "                                       OR ISNULL(s.[批次号],N'')=N'')))"
                + " GROUP BY a.工单行id, s.gxdm";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, 5);
            ps.setLong(2, 6);
            try (ResultSet rs = ps.executeQuery()) {
                int n = 0;
                while (rs.next()) {
                    System.out.println("[opAggs] 行=" + rs.getLong(1) + " 工序=" + rs.getString(2)
                            + " 已报工=" + rs.getDouble(3) + " 待审核=" + rs.getDouble(4)
                            + " 完成时间=" + rs.getString(5) + " 单数=" + rs.getLong(6));
                    n++;
                }
                System.out.println("[opAggs] 返回 " + n + " 组");
            }
        }
    }

    /** 测试账套:事务内试插卡头 + 工序行 + 读回,结束回滚(不落数据) */
    static void writeTest(Connection c) throws SQLException {
        c.setAutoCommit(false);
        try {
            long cardId;
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO dbo.wo_proc_card_head (卡号, 大批次号, 小批次号, 批次来源, 工单号, 工单行号,"
                            + " 工单行id, 产品编码, 产品名称, 规格型号, 计划数量, 生产线, 工艺路线, 卡状态, 备注,"
                            + " asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,N'录入中',?,?,SYSDATETIME(),N'N')",
                    PreparedStatement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, "LZK-JDBC-PROBE");
                ps.setString(2, "20261016");
                ps.setString(3, "JDBC-PROBE");
                ps.setString(4, "工单日期");
                ps.setString(5, "GD-PROBE");
                ps.setInt(6, 1);
                ps.setLong(7, 59);
                ps.setString(8, "C-78-10");
                ps.setString(9, "探针");
                ps.setString(10, "规格");
                ps.setDouble(11, 100);
                ps.setString(12, "线");
                ps.setString(13, "GY-CB-STD");
                ps.setString(14, "备注");
                ps.setString(15, "probe");
                ps.executeUpdate();
            }
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT id FROM dbo.wo_proc_card_head WHERE 卡号=N'LZK-JDBC-PROBE'")) {
                rs.next();
                cardId = rs.getLong(1);
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO dbo.wo_proc_card_detail (卡id, 卡号, 工序序, 工序, 工序编码, 生产车间,"
                            + " 计划数量, 计划生产线, 实际生产线, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,SYSDATETIME(),N'N')")) {
                ps.setLong(1, cardId);
                ps.setString(2, "LZK-JDBC-PROBE");
                ps.setInt(3, 1);
                ps.setString(4, "成型");
                ps.setString(5, "OP-CX");
                ps.setString(6, "成型");
                ps.setDouble(7, 100);
                ps.setNull(8, java.sql.Types.NVARCHAR);
                ps.setNull(9, java.sql.Types.NVARCHAR);
                ps.setString(10, "probe");
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement(HEAD_SELECT + " WHERE c.卡号=?")) {
                ps.setString(1, "LZK-JDBC-PROBE");
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    System.out.println("[write] 读回 卡id=" + rs.getLong("卡id") + " 卡号=" + rs.getString("卡号")
                            + " 批次来源=" + rs.getString("批次来源") + " 报工批次=[" + rs.getString("报工批次") + "]"
                            + " 更新时间=" + rs.getString("更新时间"));
                }
            }
            c.rollback();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM dbo.wo_proc_card_head")) {
                rs.next();
                System.out.println("[write] 回滚后卡头行数=" + rs.getInt(1) + "(应为 0)");
            }
        } finally {
            c.setAutoCommit(true);
        }
    }
}
