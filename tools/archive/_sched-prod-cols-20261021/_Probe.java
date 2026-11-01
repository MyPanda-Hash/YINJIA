// _Probe.java — 一次性探针(2026-10-21):快速排产②③已排产列表要补「产品/规格型号」列,
// 先确认 plang 里已排工单行的 dm/mc/gg 到底有没有值(空值列加了也白加)。
// 用法(tools 目录): java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar archive\_sched-prod-cols-20261021\_Probe.java [DB]
import java.sql.*;

public class _Probe {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        String user = "yinjia";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[db] " + db);
            System.out.println("\n[1] 已排产行(dm/mc/gg 空值统计)");
            q(c, "SELECT COUNT(*) AS 已排行数,"
                    + " SUM(CASE WHEN ISNULL(p.dm,'')='' THEN 1 ELSE 0 END) AS dm空,"
                    + " SUM(CASE WHEN ISNULL(p.mc,'')='' THEN 1 ELSE 0 END) AS mc空,"
                    + " SUM(CASE WHEN ISNULL(p.gg,'')='' THEN 1 ELSE 0 END) AS gg空"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''");
            System.out.println("\n[2] 截图里那几张单");
            q(c, "SELECT TOP 20 p.pl_no, p.pl_xc, ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.scx,N'') AS 产线,"
                    + " ISNULL(p.dm,N'') AS 产品编号, ISNULL(p.mc,N'') AS 品名, ISNULL(p.gg,N'') AS 型号,"
                    + " ISNULL(p.gg2,N'') AS 规格2, ISNULL(p.jldw,N'') AS 单位"
                    + " FROM dbo.plang p WHERE p.pl_no IN (N'GD-2026-10-0198',N'GD-2026-10-0202',"
                    + " N'GD-2026-10-0223',N'GD-2026-10-0224') ORDER BY p.pl_no, p.pl_xc");
            System.out.println("\n[3] 全量已排产行(样例 15 行)");
            q(c, "SELECT TOP 15 p.pl_no, p.pl_xc, ISNULL(p.scx,N'') AS 产线, ISNULL(p.dm,N'') AS 产品编号,"
                    + " ISNULL(p.mc,N'') AS 品名, ISNULL(p.gg,N'') AS 型号"
                    + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'')<>N''"
                    + " ORDER BY p.scx, p.pl_no, p.pl_xc");
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
