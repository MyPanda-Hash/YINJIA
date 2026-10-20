// Probe2.java — 只读核查(第二批):采购订单里「行级附加字段」的实际填充率,用于判断
//   kf_date(金蝶「生产日期」)为空是**源数据空**还是**同步没落**。
// 对照组:同属 autoExtraLines 自动映射的其它行级键(产地/注册证号/生产许可证号/批次号/商品是否开启批次)。
// 用法: java -cp tools\lib\mssql-jdbc.jar tools\archive\_kd-po-kfdate-probe-20261020\Probe2.java
import java.sql.*;

public class Probe2 {
    static final String DB = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + DB + ";encrypt=false;loginTimeout=10";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static void q(Connection c, String title, String sql) {
        System.out.println("\n---- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            ResultSetMetaData m = rs.getMetaData();
            StringBuilder head = new StringBuilder();
            for (int i = 1; i <= m.getColumnCount(); i++) head.append(i > 1 ? " | " : "").append(m.getColumnLabel(i));
            System.out.println("  " + head);
            int n = 0;
            while (rs.next() && n++ < 60) {
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
            q(c, "A 采购订单头:金蝶同步来的单数 vs 总单数",
                "SELECT COUNT(*) AS 总头数, "
              + "       SUM(CASE WHEN ISNULL(外部数据ID,N'') <> N'' THEN 1 ELSE 0 END) AS 金蝶同步头数, "
              + "       SUM(CASE WHEN ISNULL(外部数据ID,N'') =  N'' THEN 1 ELSE 0 END) AS MES自建头数 "
              + "FROM bd_pu_order");

            q(c, "B 行级附加字段填充率(对照组:同为 autoExtraLines 自动映射的键)",
                "SELECT COUNT(*) AS 明细行数, "
              + " SUM(CASE WHEN ISNULL(批次号,N'')<>N'' THEN 1 ELSE 0 END) AS 批次号, "
              + " SUM(CASE WHEN ISNULL(产地,N'')<>N'' THEN 1 ELSE 0 END) AS 产地, "
              + " SUM(CASE WHEN ISNULL(生产许可证号,N'')<>N'' THEN 1 ELSE 0 END) AS 生产许可证号, "
              + " SUM(CASE WHEN ISNULL(注册证号,N'')<>N'' THEN 1 ELSE 0 END) AS 注册证号, "
              + " SUM(CASE WHEN ISNULL(商品是否开启批次,N'')<>N'' THEN 1 ELSE 0 END) AS 商品是否开启批次, "
              + " SUM(CASE WHEN ISNULL(保质期到期日,N'')<>N'' THEN 1 ELSE 0 END) AS 保质期到期日_kfdate, "
              + " SUM(CASE WHEN ISNULL(有效期至,N'')<>N'' THEN 1 ELSE 0 END) AS 有效期至, "
              + " SUM(CASE WHEN ISNULL(保质期单位类型,N'')<>N'' THEN 1 ELSE 0 END) AS 保质期单位类型 "
              + "FROM bl_pu_order");

            q(c, "C 只看金蝶同步来的采购订单行(排除 MES 自建单)",
                "SELECT COUNT(*) AS 同步单明细行数, "
              + " SUM(CASE WHEN ISNULL(l.批次号,N'')<>N'' THEN 1 ELSE 0 END) AS 批次号, "
              + " SUM(CASE WHEN ISNULL(l.保质期到期日,N'')<>N'' THEN 1 ELSE 0 END) AS 保质期到期日, "
              + " SUM(CASE WHEN ISNULL(l.有效期至,N'')<>N'' THEN 1 ELSE 0 END) AS 有效期至 "
              + "FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号=l.单据编号 "
              + "WHERE ISNULL(h.外部数据ID,N'') <> N''");

            q(c, "D bl_pu_order 全列(核对是否存在「生产日期」列)",
                "SELECT c.name AS col, ty.name AS type, c.max_length "
              + "FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id "
              + "WHERE c.object_id=OBJECT_ID(N'dbo.bl_pu_order') ORDER BY c.column_id");

            q(c, "E 商品档案里启用保质期的商品数(判断金蝶侧为何没有 kf_date)",
                "SELECT COUNT(*) AS 商品总数, "
              + " SUM(CASE WHEN ISNULL(是否启用保质期,N'') IN (N'1',N'true',N'是') THEN 1 ELSE 0 END) AS 启用保质期数 "
              + "FROM dm_sp WHERE 1=1");
        }
    }
}
