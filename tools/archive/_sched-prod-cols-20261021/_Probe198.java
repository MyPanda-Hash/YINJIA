// _Probe198.java — 一次性探针(2026-10-21):截图里 GD-2026-10-0198 行3 为何不在 today() 结果里,
// 同时核对测试账套是否就是截图那一版(两库各看一次 0198/0202/0223/0224 全部行)。
// 用法(tools 目录): %JAVA25% -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_sched-prod-cols-20261021\_Probe198.java
import java.sql.*;

public class _Probe198 {
    public static void main(String[] args) throws Exception {
        for (String db : new String[]{"HSDZ_MES", "HSDZ_MES_TEST"}) {
            String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
            try (Connection c = DriverManager.getConnection(url, "yinjia",
                    System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
                System.out.println("\n===== " + db);
                q(c, "SELECT p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线, ISNULL(p.dm,N'') AS 产品编号,"
                        + " ISNULL(p.pl_sl,0) AS 排产, ISNULL(p.xq_sl,0) AS 需求, ISNULL(p.rk_sl,0) AS 入库,"
                        + " ISNULL(p.ja,N'') AS ja, ISNULL(p.[完工状态],N'') AS 完工状态,"
                        + " ISNULL(p.asp_cancel,N'') AS 作废, CONVERT(varchar(19), p.asp_time2, 120) AS 排产时间"
                        + " FROM dbo.plang p WHERE p.pl_no IN (N'GD-2026-10-0198',N'GD-2026-10-0202',"
                        + " N'GD-2026-10-0223',N'GD-2026-10-0224') ORDER BY p.pl_no, p.pl_xc");
            } catch (SQLException e) {
                System.out.println("[跳过] " + db + " 连不上/无表: " + e.getMessage());
            }
        }
    }

    static void q(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData md = rs.getMetaData();
            int n = md.getColumnCount();
            StringBuilder h = new StringBuilder();
            for (int i = 1; i <= n; i++) h.append(i > 1 ? " | " : "").append(md.getColumnLabel(i));
            System.out.println(h);
            while (rs.next()) {
                StringBuilder b = new StringBuilder();
                for (int i = 1; i <= n; i++) b.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println(b);
            }
        }
    }
}
