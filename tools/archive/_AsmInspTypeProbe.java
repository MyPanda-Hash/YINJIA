import com.yinjia.mes.service.AsmInspItems;
import com.yinjia.mes.service.QcAsmInspReportSupport;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;

/**
 * 一次性探针(只读):组装成品检验单「表区 → 检验类型」正名后的两处后端行为取证。
 *
 * ① {@link AsmInspItems#load} —— 生单预铺:按产品编码取出货检验计划里 外观/尺寸/出货重量 三类的检验项,
 *    断言「归一到三类」「其它类别(性能)不带入」「行键 = 检验类型/检验项目/检验要求/检验方法/检查频率」;
 * ② {@link QcAsmInspReportSupport#matrix} —— 改名列之后报表还能不能按类别分段
 *    (行里的键现在是 检验类型,不再是 表区)。
 *
 * 跑法(在 tools 下;classpath 见 _q_asminsp 说明):
 *   java -cp "..\backend\target\classes;&lt;mvn 依赖 classpath&gt;" archive\_AsmInspTypeProbe.java HSDZ_MES C-84-02
 */
public class _AsmInspTypeProbe {

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String product = args.length > 1 ? args[1] : "C-84-02";
        // 取证输出写 UTF-8 文件(控制台重定向会按控制台码页转码,中文会变乱码;同 tools/archive/_q.java 惯例)
        if (args.length > 2) {
            System.setOut(new java.io.PrintStream(java.nio.file.Files.newOutputStream(java.nio.file.Paths.get(args[2])),
                    true, "UTF-8"));
        }
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10", "yinjia", pass);
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        int bad = 0;

        System.out.println("=== [" + db + "] ① AsmInspItems.load(" + product + ") 生单预铺 ===");
        AsmInspItems.Result r = AsmInspItems.load(jdbc, product);
        System.out.println("命中计划单 = " + r.planNo() + " / 预铺行数 = " + r.rows().size());
        for (Map<String, Object> row : r.rows()) {
            System.out.println("   " + row);
        }
        boolean keysOk = r.rows().stream().allMatch(row -> row.containsKey("检验类型") && row.containsKey("检验项目")
                && row.containsKey("检验要求") && row.containsKey("检验方法") && row.containsKey("检查频率"));
        if (!keysOk) { bad++; System.out.println("   [FAIL] 行键不齐(应为 检验类型/检验项目/检验要求/检验方法/检查频率)"); }
        boolean typesOk = r.rows().stream().allMatch(row -> List.of("外观", "尺寸", "出货重量").contains(String.valueOf(row.get("检验类型"))));
        if (!typesOk) { bad++; System.out.println("   [FAIL] 检验类型未归一(应 ∈ 外观/尺寸/出货重量)"); }
        // 计划里的「性能」(余氯去除率)不得被默认带入
        boolean noPerf = r.rows().stream().noneMatch(row -> String.valueOf(row.get("检验项目")).contains("余氯"));
        if (!noPerf) { bad++; System.out.println("   [FAIL] 性能类检验项不该被默认带入"); }

        System.out.println("=== [" + db + "] ② 报表矩阵(按 检验类型 分段) ===");
        // List 泛型不变:queryForList 的 List<Map<String,Object>> 不能直填 Collection<Map<String,?>>,拷贝定型
        // (与 ReportService 里同一处写法)
        List<Map<String, ?>> rows = new java.util.ArrayList<>(jdbc.queryForList(
                "SELECT ISNULL([检验类型],N'') AS 检验类型, ISNULL([检验项目],N'') AS 检验项目,"
                        + " ISNULL([检验结果],N'') AS 检验结果,"
                        // 测量值列是 decimal:ISNULL(列,N'') 会把 N'' 转成 numeric 而报错 ⇒ 先转字符串
                        + " ISNULL(CONVERT(nvarchar(50),[测量值1]),N'') AS 测量值1,"
                        + " ISNULL([结果判断],N'') AS 结果判断"
                        + " FROM dbo.qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id"));
        System.out.println("明细行数(全库非作废)= " + rows.size());
        QcAsmInspReportSupport.Matrix m = QcAsmInspReportSupport.matrix(rows, "");
        System.out.println(QcAsmInspReportSupport.describe(m));
        // 老键 (表区) 兼容读一次:部署顺序(先换 jar / 先跑迁移)不同时报表都不掉组
        Map<String, Object> legacy = new java.util.LinkedHashMap<>();
        legacy.put("表区", "外观");
        legacy.put("检验项目", "兼容读旧键");
        QcAsmInspReportSupport.Matrix m2 = QcAsmInspReportSupport.matrix(List.<Map<String, ?>>of(legacy), "");
        if (!QcAsmInspReportSupport.describe(m2).contains("外观")) {
            bad++; System.out.println("   [FAIL] 旧键 表区 的兼容读失效");
        } else {
            System.out.println("   ok 旧键 表区 兼容读仍可分段");
        }

        System.out.println(bad == 0 ? "=== [PASS] 组装成品检验单正名后的后端行为 ==="
                : "=== [FAIL] " + bad + " 项 ===");
        if (bad > 0) System.exit(1);
    }
}
