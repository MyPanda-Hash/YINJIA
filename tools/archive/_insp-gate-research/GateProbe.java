import com.yinjia.mes.service.WoInspGate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;

/**
 * 门禁落库实证(2026-10-19,只读):直接调用现役 {@link WoInspGate},对**真库数据**跑一遍,
 * 证明「成型完成前后的工单行分别被判成什么」——不依赖 8090 是否重启。
 *
 * <pre>
 *   cd backend
 *   &lt;JDK25&gt;\bin\javac -encoding UTF-8 -cp "target\classes;$(cat target\cp.txt)" ..\tools\archive\_insp-gate-research\GateProbe.java
 *   &lt;JDK25&gt;\bin\java -Dstdout.encoding=UTF-8 -cp "target\classes;..\tools\archive\_insp-gate-research;$(cat target\cp.txt)" GateProbe HSDZ_MES
 * </pre>
 */
public class GateProbe {

    public static void main(String[] args) {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true;loginTimeout=10",
                "yinjia", "Yinjia@2026");
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        System.out.println("==================== " + db + " (口径 " + WoInspGate.CALIBER + ") ====================");

        // 与 QcProcInspController.woLines 同一段取数(少了 keyword 过滤)
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.dm,N'') AS 产品编码, ISNULL(p.[批次号],N'') AS 批次号,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.[工艺路线],N'') AS 工艺路线"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(p.ja,'N') NOT IN (N'Y',N'T')"
                        + " ORDER BY p.pl_no DESC, p.pl_xc OFFSET 0 ROWS FETCH NEXT 30 ROWS ONLY");

        Map<String, WoInspGate.Status> gate = WoInspGate.checkPage(jdbc, rows);
        int ok = 0, blocked = 0, exempt = 0, legacy = 0;
        System.out.printf("%-16s %-4s %10s %10s %-8s %-8s %-8s %s%n",
                "工单号", "行", "成型完工量", "成型计划量", "可开单", "免门禁", "存量放行", "原因/说明");
        for (Map<String, Object> r : rows) {
            String k = WoInspGate.key(String.valueOf(r.get("工单号")), ((Number) r.get("工单行号")).intValue());
            WoInspGate.Status s = gate.get(k);
            if (s == null) continue;
            if (s.allowed()) ok++; else blocked++;
            if (s.exempt()) exempt++;
            if (s.legacy()) legacy++;
            System.out.printf("%-16s %-4s %10s %10s %-8s %-8s %-8s %s%n",
                    r.get("工单号"), r.get("工单行号"), s.moldDone(), s.moldPlan(),
                    s.allowed() ? "✔" : "✘", s.exempt() ? "✔" : "", s.legacy() ? "✔" : "",
                    s.reason());
        }
        System.out.printf("%n本页 %d 行:放行 %d / 拦截 %d(其中 免门禁 %d、存量放行 %d)%n",
                rows.size(), ok, blocked, exempt, legacy);

        // 单行接口:挑一条真实有成型报工的工单行 + 一条没有的
        for (String[] t : new String[][]{{"GD-2026-10-0007", "1"}, {"GD-2026-10-0003", "1"}, {"GD-2026-10-0004", "1"}}) {
            WoInspGate.Status s = WoInspGate.check(jdbc, t[0], Integer.parseInt(t[1]));
            System.out.printf("check(%s #%s) → 可开单=%s 完工量=%s 计划量=%s 原因=%s%n",
                    t[0], t[1], s.allowed(), s.moldDone(), s.moldPlan(), s.reason());
        }
    }
}
