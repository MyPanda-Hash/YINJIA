import java.io.*;
import java.sql.*;
import java.util.*;

/**
 * 一次性只读取证(2026-10-19):「小程序报工后正常单据出现结案异常」。
 * 只执行 SELECT,不写任何数据。用法:
 *   java -cp "lib/mssql-jdbc.jar;archive/_close-anomaly-20261019" _Q HSDZ_MES
 */
public class _Q {
    static PrintStream out;
    static Connection c;

    public static void main(String[] a) throws Exception {
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
        String db = a.length > 0 ? a[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db
                + ";encrypt=false;trustServerCertificate=true;loginTimeout=10;lockTimeout=15000";
        c = DriverManager.getConnection(url, "yinjia", "Yinjia@2026");
        out.println("== DB " + db + " ==");

        section("0. plang 表触发器(谁会替小程序悄悄写 ja)");
        q("SELECT t.name AS 触发器, OBJECT_NAME(t.parent_id) AS 表名, t.is_disabled AS 已禁用,"
                + " CAST(m.definition AS nvarchar(max)) AS 定义 FROM sys.triggers t"
                + " JOIN sys.sql_modules m ON m.object_id = t.object_id"
                + " WHERE OBJECT_NAME(t.parent_id) IN (N'plang', N'scjl', N'plang_pc')");

        section("1. 结案异常总量(ja=T/Y 但 排产<=0 或 入库<排产,且无已审组装成品检验)");
        q("SELECT COUNT(*) AS 异常行数 FROM dbo.plang p"
                + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                + "   AND NOT (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)"
                + "     AND EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h"
                + "       JOIN dbo.yj_doc_status ds ON ds.panel_code=N'QC_ASM_INSP' AND ds.doc_no=h.[单据编号]"
                + "       WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'"
                + "         AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y' AND ISNULL(ds.stopped,'N')<>'Y'"
                + "         AND (ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)"
                + "              OR (ISNULL(h.[工单行号],0)=0 AND ISNULL(h.[批次号],N'')<>N''"
                + "                  AND ISNULL(h.[批次号],N'')=ISNULL(p.[批次号],N'')))))"
                + "   AND p.pl_no NOT LIKE N'GD2608%'");

        section("2. 异常行按 工单号 分布(前 25)");
        q("SELECT TOP 25 p.pl_no AS 工单号, COUNT(*) AS 行数, MIN(ISNULL(p.pl_xc,0)) AS 最小行号,"
                + " MAX(ISNULL(p.pl_xc,0)) AS 最大行号, SUM(CASE WHEN ISNULL(p.pl_sl,0)=0 THEN 1 ELSE 0 END) AS 未排产行,"
                + " MAX(ISNULL(p.asp_user2,N'(空)')) AS 最后修改人,"
                + " CONVERT(varchar(19), MAX(p.asp_time2), 120) AS 最近修改时间"
                + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                + "   AND NOT (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)"
                + "     AND EXISTS (SELECT 1 FROM dbo.qc_asm_insp_head h"
                + "       JOIN dbo.yj_doc_status ds ON ds.panel_code=N'QC_ASM_INSP' AND ds.doc_no=h.[单据编号]"
                + "       WHERE h.[工单号]=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'"
                + "         AND ds.shr IS NOT NULL AND ISNULL(ds.canceled,'N')<>'Y' AND ISNULL(ds.stopped,'N')<>'Y'"
                + "         AND (ISNULL(h.[工单行号],0)=ISNULL(p.pl_xc,0)"
                + "              OR (ISNULL(h.[工单行号],0)=0 AND ISNULL(h.[批次号],N'')<>N''"
                + "                  AND ISNULL(h.[批次号],N'')=ISNULL(p.[批次号],N'')))))"
                + "   AND p.pl_no NOT LIKE N'GD2608%'"
                + " GROUP BY p.pl_no ORDER BY COUNT(*) DESC, p.pl_no DESC");

        section("3. 截图那几张单的逐行明细");
        q("SELECT p.id AS 行id, p.pl_no AS 工单号, ISNULL(p.pl_xc,0) AS 行号, ISNULL(p.[批次号],N'') AS 批次号,"
                + " ISNULL(p.scx,N'(空)') AS 生产线, ISNULL(p.[完工状态],N'(空)') AS 完工状态,"
                + " ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.rk_sl,0) AS 入库, ISNULL(p.ja,N'(空)') AS ja,"
                + " ISNULL(p.asp_user1,N'') AS 建单人, ISNULL(p.asp_user2,N'') AS 最后修改人,"
                + " CONVERT(varchar(19),p.asp_time1,120) AS 建单时间, CONVERT(varchar(19),p.asp_time2,120) AS 最后修改时间,"
                + " CONVERT(varchar(10),p.pl_date,120) AS 工单日期"
                + " FROM dbo.plang p WHERE p.pl_no IN (N'GD-2026-10-0018',N'GD-2026-10-0021',N'GD-2026-10-0019',N'GD-2026-10-0023',N'GD-2026-10-0022')"
                + " ORDER BY p.pl_no, p.pl_xc");

        section("4. 这些工单的报工行(scjl:F=外部直写特征 报工单号空)");
        q("SELECT s.id, s.gldh AS 工单号, ISNULL(s.[工单行号],0) AS 行号, ISNULL(s.gxdm,N'') AS 工序,"
                + " CONVERT(varchar(19),s.sc_date,120) AS 报工时间, ISNULL(s.sl,0) AS 数量,"
                + " ISNULL(s.[报工单号],N'(空)') AS 报工单号, ISNULL(s.scx,N'(空)') AS 生产线,"
                + " ISNULL(s.wgzt,N'') AS 完工标志, ISNULL(s.asp_user1,N'') AS 录入人,"
                + " CONVERT(varchar(19),s.asp_time1,120) AS 录入时间"
                + " FROM dbo.scjl s WHERE s.gldh IN (N'GD-2026-10-0018',N'GD-2026-10-0021',N'GD-2026-10-0019')"
                + " ORDER BY s.gldh, s.sc_date, s.id");

        section("5. 近期「结案/取消结案」使用留痕(近 7 天,最多 30 条)");
        q("SELECT TOP 30 CONVERT(varchar(19),l.created_at,120) AS 时间, ISNULL(l.user_name,N'') AS 用户,"
                + " ISNULL(l.action_name,N'') AS 动作, ISNULL(l.doc_no,N'') AS 单号, ISNULL(l.line_no,N'') AS 行号"
                + " FROM dbo.yj_usage_log l WHERE l.action_name LIKE N'%结案%'"
                + "   AND l.created_at >= DATEADD(day,-7,GETDATE()) ORDER BY l.created_at DESC");

        section("6. ja 的写入时间与报工时间是否同源(异常行按小时聚合)");
        q("SELECT CONVERT(varchar(13), p.asp_time2, 120) AS 修改小时, COUNT(*) AS 行数,"
                + " ISNULL(p.asp_user2,N'(空)') AS 修改人"
                + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.ja,'N') IN (N'T',N'Y')"
                + "   AND ISNULL(p.rk_sl,0) < ISNULL(p.pl_sl,0)"
                + " GROUP BY CONVERT(varchar(13), p.asp_time2, 120), p.asp_user2 ORDER BY 1 DESC");

        c.close();
    }

    static void section(String s) { out.println("\n---- " + s + " ----"); }

    static void q(String sql) {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            int n = m.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(m.getColumnLabel(i)).append(i < n ? " | " : "");
            out.println(h);
            int rows = 0;
            while (rs.next() && rows < 200) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) {
                    String v = rs.getString(i);
                    b.append(v == null ? "" : v).append(i < n ? " | " : "");
                }
                out.println(b);
                rows++;
            }
            out.println("(" + rows + " 行)");
        } catch (SQLException e) {
            out.println("SQL 失败: " + e.getMessage());
        }
    }
}
