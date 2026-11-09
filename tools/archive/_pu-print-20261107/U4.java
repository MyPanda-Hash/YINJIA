import com.yinjia.mes.service.BatchService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.UnitQtyNormalizer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.LinkedHashMap;
import java.util.Map;

/** 只读验证:UnitQtyNormalizer 按计量单位取整(不写库)。 */
public class U4 {
    public static void main(String[] args) {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10", "yinjia", "Yinjia@2026");
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        BatchService batch = new BatchService(jdbc, new PanelRegistry(jdbc));
        UnitQtyNormalizer n = new UnitQtyNormalizer(batch);

        check(n, "个 4.6 → 4", row("数量", 4.6, "计量单位", "个"), "数量", 4.0);
        check(n, "卷 2.4 → 2", row("数量", 2.4, "计量单位", "卷"), "数量", 2.0);
        check(n, "kg 304.6123 → 304.612", row("实收数量", 304.6123, "计量单位", "kg"), "实收数量", 304.612);
        check(n, "米 3 位", row("数量", 12.34567, "计量单位", "米"), "数量", 12.345);
        check(n, "PCS 编码也算计件", row("数量", 4.6, "单位", "PCS"), "数量", 4.0);
        Map<String, Object> one = row("数量", 4.6);
        n.normalizeRow(one);
        System.out.println("无单位不动: 数量=" + one.get("数量") + (Double.valueOf(4.6).equals(one.get("数量")) ? "  [PASS]" : "  [FAIL]"));
        Map<String, Object> dua = row("数量", 4.6, "计量单位", "个");
        dua.put("数量2", 10.5555);
        dua.put("计量单位2", "kg");
        n.normalizeRow(dua);
        System.out.println("双单位: 数量=" + dua.get("数量") + " 数量2=" + dua.get("数量2")
                + (Double.valueOf(4.0).equals(dua.get("数量")) && Double.valueOf(10.555).equals(dua.get("数量2")) ? "  [PASS]" : "  [FAIL]"));
        Map<String, Object> money = row("数量", 4.6, "计量单位", "个");
        money.put("金额", 123.4567);
        money.put("单价", 1.2345);
        n.normalizeRow(money);
        System.out.println("金额/单价不动: 金额=" + money.get("金额") + " 单价=" + money.get("单价")
                + (Double.valueOf(123.4567).equals(money.get("金额")) && Double.valueOf(1.2345).equals(money.get("单价")) ? "  [PASS]" : "  [FAIL]"));
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    private static void check(UnitQtyNormalizer n, String label, Map<String, Object> row, String key, double expect) {
        n.normalizeRow(row);
        double got = ((Number) row.get(key)).doubleValue();
        System.out.println(label + ": " + got + (Math.abs(got - expect) < 1e-9 ? "  [PASS]" : "  [FAIL expect " + expect + "]"));
    }
}
