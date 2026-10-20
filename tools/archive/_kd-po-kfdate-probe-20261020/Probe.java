// Probe.java — 只读核查:金蝶「生产日期」(kf_date) 在 MES 采购订单上的落库情况
//   ① bd_pu_order / bl_pu_order 里与 生产日期/保质期 相关的列有哪些
//   ② 采购订单行里这些列的**非空行数 / 总行数**
//   ③ yj_field(PU_ORDER) 是否登记了这些列(界面能不能看到)
//   ④ 抽 5 行样例值
// 用法: java -cp tools\lib\mssql-jdbc.jar tools\archive\_kd-po-kfdate-probe-20261020\Probe.java [库名]
import java.sql.*;
import java.util.*;

public class Probe {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static void q(Connection c, String title, String sql) {
        System.out.println("\n---- " + title);
        System.out.println("SQL: " + sql.replaceAll("\\s+", " ").trim());
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            int n = 0;
            while (rs.next() && n++ < 40) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= m.getColumnCount(); i++) {
                    String v = rs.getString(i);
                    row.append(i > 1 ? " | " : "").append(v == null ? "<null>" : v);
                }
                System.out.println("  " + row);
            }
            if (n == 0) System.out.println("  (no rows)");
        } catch (Exception e) {
            System.out.println("  ERR: " + e.getMessage());
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("DB=" + DB + " @" + java.time.LocalDateTime.now());
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            q(c, "库/用户", "SELECT DB_NAME() AS db, SUSER_SNAME() AS login_name");

            q(c, "① 采购订单两表的 生产日期/保质期/有效期 相关列",
                "SELECT t.name AS tbl, c.name AS col, ty.name AS type, c.max_length, c.is_nullable "
              + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
              + "WHERE t.name IN ('bd_pu_order','bl_pu_order') "
              + "  AND (c.name LIKE N'%生产日期%' OR c.name LIKE N'%保质期%' OR c.name LIKE N'%有效%' OR c.name LIKE N'%kf%') "
              + "ORDER BY t.name, c.column_id");

            q(c, "①b 两表全部列名(核对有无生产日期)",
                "SELECT t.name AS tbl, STRING_AGG(c.name, N' / ') WITHIN GROUP (ORDER BY c.column_id) AS cols "
              + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
              + "WHERE t.name IN ('bd_pu_order','bl_pu_order') GROUP BY t.name");

            q(c, "② 采购订单总量(头/行)",
                "SELECT (SELECT COUNT(*) FROM bd_pu_order) AS 头行数, (SELECT COUNT(*) FROM bl_pu_order) AS 明细行数");

            q(c, "③ yj_field(PU_ORDER) 中与 生产日期/保质期/有效 相关的字段登记",
                "SELECT col_name, label, data_type, place, seq, visible, hidden, editable, required "
              + "FROM yj_field WHERE panel_code=N'PU_ORDER' "
              + "  AND (col_name LIKE N'%生产日期%' OR col_name LIKE N'%保质期%' OR col_name LIKE N'%有效%') "
              + "ORDER BY seq");

            q(c, "④ 采购订单行:kf 相关列的非空统计(动态)",
                "DECLARE @sql NVARCHAR(MAX)=N''; "
              + "SELECT @sql = @sql + N'SELECT N''' + c.name + N''' AS 列, COUNT(*) AS 非空行数 FROM bl_pu_order WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100),[' + c.name + N']))) , N'''') IS NOT NULL UNION ALL ' "
              + "FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
              + "WHERE t.name=N'bl_pu_order' AND (c.name LIKE N'%生产日期%' OR c.name LIKE N'%保质期%' OR c.name LIKE N'%有效%'); "
              + "IF LEN(@sql)>0 BEGIN SET @sql = LEFT(@sql, LEN(@sql)-10); EXEC sp_executesql @sql; END ELSE SELECT N'(无相关列)' AS 列, 0 AS 非空行数;");

            q(c, "⑤ 采购订单行样例(前 5 行,带 kf 相关列)",
                "DECLARE @sql NVARCHAR(MAX)=N'SELECT TOP 5 单据编号, 行号'; "
              + "SELECT @sql = @sql + N', [' + c.name + N']' FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id "
              + "WHERE t.name=N'bl_pu_order' AND (c.name LIKE N'%生产日期%' OR c.name LIKE N'%保质期%' OR c.name LIKE N'%有效%' OR c.name=N'批次号'); "
              + "SET @sql = @sql + N' FROM bl_pu_order ORDER BY id DESC'; EXEC sp_executesql @sql;");
        }
    }
}
