import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * FieldMetaDump —— 把 RD_* 面板的 yj_field 元数据按 **TSV** 全量打到 stdout。
 *
 * 为什么不用 SqlRunner：它给迁移脚本做的是**人读**输出，SELECT 结果**只打 50 行**
 * （SqlRunner.java 的 `rs.next() && n < 50`），而 yj_field 的 RD 面板有 950+ 行 ——
 * 2026-11-06 用 SqlRunner 生成 rdPanelLabels.fixture.json 时就被截到 50 行，
 * 表现为 JSON 解析报 Unterminated string / 夹具只剩一小撮字段。
 *
 * 为什么不用 FOR JSON：同一个 SELECT 的 JSON 结果在 macOS 驱动下会被拆成 ~2KB 的多行、
 * 且尾部截断（实测 101,650 字符处断），按行拼回去也拼不全。TSV 没这个问题。
 *
 * 输出列（tab 分隔，一行一个字段）：
 *   panel_code  place  col_name  label  required  hidden  visible
 *
 * 用法（在 tools/ 目录下；密码可用环境变量 YINJIA_SQL_PASSWORD 代替第 3 个参数）：
 *   java -cp lib/mssql-jdbc.jar verify/FieldMetaDump.java \
 *        "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true" \
 *        yinjia 'Yinjia@2026'
 *
 * 被谁用：tools/gen-config-key-fixture.cjs（生成前端单测基线 rdPanelLabels.fixture.json）。
 */
public class FieldMetaDump {
    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("用法: FieldMetaDump <jdbcUrl> <user> [pass|env]");
            System.exit(2);
        }
        String url = args[0], user = args[1];
        String pass = (args.length > 2 && !"env".equals(args[2]))
                ? args[2]
                : System.getenv().getOrDefault("YINJIA_SQL_PASSWORD",
                        System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
        String sql = "SELECT CONVERT(NVARCHAR(MAX), panel_code) + NCHAR(9) + ISNULL(place, N'') + NCHAR(9)"
                + " + CONVERT(NVARCHAR(MAX), col_name) + NCHAR(9) + ISNULL(label, N'') + NCHAR(9)"
                + " + CONVERT(NVARCHAR(5), ISNULL(required, 0)) + NCHAR(9)"
                + " + CONVERT(NVARCHAR(5), ISNULL(hidden, 0)) + NCHAR(9)"
                + " + CONVERT(NVARCHAR(5), ISNULL(visible, 1))"
                + " FROM yj_field WHERE panel_code LIKE 'RD[_]%' ORDER BY panel_code, place, seq";
        try (Connection c = DriverManager.getConnection(url, user, pass);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next()) {
                System.out.println(rs.getString(1));
                n++;
            }
            System.err.println("[FieldMetaDump] rows=" + n);
        }
    }
}
