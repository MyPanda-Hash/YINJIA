import com.yinjia.mes.service.AsmInspStockQty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * 一次性探针(只读):组装成品检验单表头「合格数量」的口径取证。
 *
 * ① 纯规则 {@link AsmInspStockQty#resolve}(没填 / 负数 / 超过检验数量 → 拒绝;=0 → 合法不生成);
 * ② 真库真值:把现役单据的 检验数量 + 合格数量喂进同一段**生产代码**,看会得到什么结论
 *    (空值 ⇒ 审核会被挡;填了值 ⇒ 入库数量就是它)。
 *
 * 跑法(在 tools 下):
 *   java -cp "..\backend\target\classes;&lt;mvn 依赖 classpath&gt;" archive\_AsmInspPassQtyProbe.java HSDZ_MES [out]
 */
public class _AsmInspPassQtyProbe {

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        if (args.length > 1) {
            System.setOut(new PrintStream(Files.newOutputStream(Paths.get(args[1])), true, "UTF-8"));
        }
        int bad = 0;

        System.out.println("=== [" + db + "] ① 规则(纯函数) ===");
        bad += expect("没填(null) → 拒绝审核", null, 50, null);
        bad += expect("没填(空串) → 拒绝审核", "  ", 50, null);
        bad += expect("44.5 / 检验数量 50 → 入库 44.5", "44.5", 50, 44.5);
        bad += expect("超过检验数量(60 > 50) → 拒绝", "60", 50, null);
        bad += expect("等于检验数量(50) → 允许", "50", 50, 50.0);
        bad += expect("填 0 → 合法但不生成入库单", "0", 50, 0.0);
        bad += expect("负数 → 拒绝", "-1", 50, null);
        bad += expect("检验数量没填(0) → 不设上限,照填值入库", "12", 0, 12.0);
        String t = AsmInspStockQty.text(44.5000);
        if (!"44.5".equals(t)) { bad++; System.out.println("  FAIL 文本去尾零: 期望 44.5 实得 " + t); }
        else System.out.println("  ok   文本去尾零 44.5000 → 44.5");

        System.out.println("=== [" + db + "] ② 现役单据真值(同一段生产代码) ===");
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10", "yinjia", pass));
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT TOP 20 单据编号, ISNULL(检验数量,0) AS 检验数量, [合格数量] AS passQty,"
                        + " ISNULL(单据状态,N'') AS st"
                        + " FROM dbo.qc_asm_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC");
        System.out.println("  单据数(取样) = " + heads.size());
        for (Map<String, Object> h : heads) {
            String no = String.valueOf(h.get("单据编号"));
            double insp = h.get("检验数量") == null ? 0 : Double.parseDouble(String.valueOf(h.get("检验数量")));
            Object pq = h.get("passQty");
            String verdict;
            try {
                double v = AsmInspStockQty.resolve(pq, insp);
                verdict = v <= 0 ? "审核放行但不生成入库单(填 0)" : ("审核 → 产成品入库单 实收数量=" + AsmInspStockQty.text(v));
            } catch (IllegalStateException e) {
                verdict = "审核被挡:" + e.getMessage();
            }
            System.out.println("  " + no + " [" + h.get("st") + "] 检验数量=" + AsmInspStockQty.text(insp)
                    + " 合格数量=" + (pq == null ? "(空)" : AsmInspStockQty.text(Double.parseDouble(String.valueOf(pq))))
                    + " ⇒ " + verdict);
        }
        System.out.println(bad == 0 ? "=== [PASS] 合格数量口径 ===" : "=== [FAIL] " + bad + " 项 ===");
        if (bad > 0) System.exit(1);
    }

    private static int expect(String name, Object declared, double inspected, Double want) {
        try {
            double got = AsmInspStockQty.resolve(declared, inspected);
            if (want != null && Math.abs(got - want) < 1e-9) {
                System.out.println("  ok   " + name + " → " + AsmInspStockQty.text(got));
                return 0;
            }
            System.out.println("  FAIL " + name + " → 期望 " + want + " 实得 " + got);
            return 1;
        } catch (IllegalStateException e) {
            if (want == null) {
                System.out.println("  ok   " + name + " → " + e.getMessage());
                return 0;
            }
            System.out.println("  FAIL " + name + " → 不该拒绝,却抛:" + e.getMessage());
            return 1;
        }
    }
}
