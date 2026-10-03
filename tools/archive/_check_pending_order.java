// _check_pending_order.java — 一次性探针(2026-09-28):验证快速排产待排产池新排序
// (asp_time1 DESC 置顶新单)在真实库上的实际输出。用法与 DbSync 相同:
//   java -cp lib\mssql-jdbc.jar archive\_check_pending_order.java   (tools 目录下,默认 HSDZ_MES)
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class _check_pending_order {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    public static void main(String[] args) throws Exception {
        String sql = "SELECT TOP 12 p.pl_no AS 工单号, p.pl_xc AS 行号,"
            + " CONVERT(varchar(19), p.asp_time1, 120) AS 转单时间,"
            + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期"
            + " FROM dbo.plang p"
            + " LEFT JOIN dbo.dm_kh dk ON dk.comm = p.comm AND dk.dm = p.khdm"
            + " WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y')"
            + "   AND ISNULL(p.scx, N'') = N''"
            + " ORDER BY p.asp_time1 DESC, p.pl_date DESC, p.pl_no, p.pl_xc";
        try (Connection c = DriverManager.getConnection(URL, USER, PASS);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            System.out.println("库=" + DB + "  待排产池(前 12 行,应最新转单时间在上):");
            int i = 0;
            while (rs.next()) {
                System.out.printf("%2d. 工单=%s 行=%s 转单时间=%s 单据日期=%s%n",
                    ++i, rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4));
            }
            if (i == 0) System.out.println("(待排产池为空——当前无未指派产线的在制工单,排序规则已由本任务写入服务层)");
        }
    }
}
