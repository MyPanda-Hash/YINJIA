import java.sql.*;

/**
 * 一次性探针(2026-10-05):生产工单列表(/api/px/workOrderList)默认取数窗口实测。
 * 目的:核实「默认只取最近15天」这一说法是否成立 —— 量出 plang 总量、近15天量,
 * 并按控制器原样的 SQL 计时(全量 vs 近15天),给「单据一多就卡」一个数量级。
 * 用法(tools 目录下):java -cp lib\mssql-jdbc.jar archive\_probe-wo-default-window\_ProbeWoList.java [DB]
 */
public class _ProbeWoList {

    static final String URL_T = "jdbc:sqlserver://127.0.0.1:1433;databaseName=%s;encrypt=false;loginTimeout=10";

    /** 与 WorkOrderListController#list 完全同源的 FROM/WHERE(默认无日期条件) */
    static final String BASE_SELECT =
            "SELECT p.comm AS 公司代码, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                    + " ISNULL(p.[批次号], N'') AS 批次号,"
                    + " p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 行号,"
                    + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期,"
                    + " CONVERT(varchar(16), p.asp_time1, 120) AS 转单时间,"
                    + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(p.khdm, N'') AS 客户代码,"
                    + " ISNULL(p.scx, N'') AS 生产线,"
                    + " ISNULL(prg.当前工序, N'') AS 当前工序"
                    + " FROM dbo.plang p"
                    + " LEFT JOIN dbo.dm_kh dk ON dk.comm = p.comm AND dk.dm = p.khdm"
                    + " LEFT JOIN dbo.v_wo_process_progress prg ON prg.单号 = p.pl_no"
                    + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y'";

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(String.format(URL_T, db), "yinjia", pass)) {
            System.out.println("== DB " + db + " ==");
            scalar(c, "plang 有效行(asp_cancel<>Y)", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            scalar(c, "plang 去重工单号", "SELECT COUNT(DISTINCT pl_no) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'");
            scalar(c, "近15天行数", "SELECT COUNT(*) FROM dbo.plang WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                    + " AND pl_date >= DATEADD(day, -15, CAST(GETDATE() AS date))");
            scalar(c, "pl_date 最早", "SELECT CONVERT(varchar(19), MIN(pl_date), 120) FROM dbo.plang");
            scalar(c, "pl_date 最新", "SELECT CONVERT(varchar(19), MAX(pl_date), 120) FROM dbo.plang");
            System.out.println("-- 按月分布(近 8 个月) --");
            rs(c, "SELECT CONVERT(char(7), pl_date, 120) AS 月, COUNT(*) AS 行数 FROM dbo.plang"
                    + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND pl_date >= DATEADD(month, -8, GETDATE())"
                    + " GROUP BY CONVERT(char(7), pl_date, 120) ORDER BY 月");
            System.out.println("-- 有生产记录(报工)的近15天行 --");
            scalar(c, "scjl 有效行", "SELECT COUNT(*) FROM dbo.scjl");

            time(c, "全量(现状:无日期条件)", BASE_SELECT + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc", 3);
            time(c, "近15天", BASE_SELECT + " AND p.pl_date >= DATEADD(day, -15, CAST(GETDATE() AS date))"
                    + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc", 3);
        }
    }

    static void scalar(Connection c, String label, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
            r.next();
            System.out.println("  " + label + " = " + r.getString(1));
        }
    }

    static void rs(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
            int n = r.getMetaData().getColumnCount();
            while (r.next()) {
                StringBuilder sb = new StringBuilder("  | ");
                for (int i = 1; i <= n; i++) sb.append(r.getString(i)).append(" | ");
                System.out.println(sb);
            }
        }
    }

    /** 跑 n 次,打印每次耗时与行数(第一次含计划编译,后几次看稳定值) */
    static void time(Connection c, String label, String sql, int n) throws SQLException {
        for (int i = 1; i <= n; i++) {
            long t0 = System.nanoTime();
            int rows = 0;
            try (Statement st = c.createStatement(); ResultSet r = st.executeQuery(sql)) {
                while (r.next()) rows++;
            }
            long ms = (System.nanoTime() - t0) / 1_000_000;
            System.out.println("  [耗时] " + label + " 第" + i + "次 = " + ms + " ms, 返回 " + rows + " 行");
        }
    }
}
