import com.yinjia.mes.service.AsmInspEntry;
import com.yinjia.mes.service.ProcessFlow;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 只读探针:验证 AsmInspEntry 新的「已进入末道工序」判据(2026-11-18)。
 *
 * <p>用法(仓库根):<pre>
 *   java -cp "backend/target/classes;$(cat backend/target/cp.txt)" \
 *        tools/archive/_asm-lastop-20261118/_AsmLastOpProbe.java [库名]
 * </pre>
 * 不写任何表,只 SELECT。
 */
public class _AsmLastOpProbe {

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        ds.setUrl("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true");
        ds.setUsername(System.getenv().getOrDefault("YINJIA_SQL_USER", "yinjia"));
        ds.setPassword(System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"));
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        System.out.println("DB = " + db);

        // 1) 工单行最新 12 行:逐行单行判定(自动出单/建单前硬校验走这条)
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 12 p.id, p.pl_no, p.pl_xc, ISNULL(p.[工艺路线],N'') AS route,"
                        + " ISNULL(p.scx,N'') AS line, ISNULL(p.[当前工序],N'') AS curOp"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id DESC");
        System.out.println("== 单行判定 AsmInspEntry.of ==");
        for (Map<String, Object> r : rows) {
            long id = ((Number) r.get("id")).longValue();
            AsmInspEntry.Status st = AsmInspEntry.of(jdbc, id);
            System.out.printf("%s#%s route=%s 当前=%s 线=%s => entered=%s op=%s avail=%s done=%s reason=%s%n",
                    r.get("pl_no"), r.get("pl_xc"), r.get("route"), r.get("curOp"), r.get("line"),
                    st.entered(), st.op(), st.avail(), st.done(), st.reason());
        }

        // 2) 同一批走批量判定(弹窗一页 20 行走这条),两套结果必须一致
        System.out.println("== 批量判定 AsmInspEntry.checkPage ==");
        List<Map<String, Object>> page = jdbc.queryForList(
                "SELECT p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线, ISNULL(p.[当前工序],N'') AS 当前工序"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id DESC"
                        + " OFFSET 0 ROWS FETCH NEXT 12 ROWS ONLY");
        Map<String, AsmInspEntry.Status> batch = AsmInspEntry.checkPage(jdbc, page);
        for (Map<String, Object> r : page) {
            AsmInspEntry.Status st = batch.get(AsmInspEntry.key(
                    String.valueOf(r.get("工单号")), ((Number) r.get("工单行号")).intValue()));
            System.out.printf("%s#%s route=%s => %s op=%s%n",
                    r.get("工单号"), r.get("工单行号"), r.get("工艺路线"),
                    st == null ? "null" : st.entered(), st == null ? "-" : st.op());
        }

        // 3) 末道工序能识别的工序名清单(数据侧实况)
        System.out.println("== 在用工艺路线的末道工序 ==");
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT DISTINCT r.工艺路线编码 AS route, r.工序名称 AS op, ISNULL(r.是否末道工序,N'') AS flag"
                        + " FROM dbo.bs_route r WHERE ISNULL(r.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(r.工序名称,N'')<>N'' ORDER BY r.工艺路线编码, r.工序名称")) {
            System.out.println(r.get("route") + "\t" + r.get("op") + "\tlastFlag=" + r.get("flag"));
        }

        // 4) 「选生产工单」列表准入 SQL(routeHasAssembly)语法 + 命中面
        System.out.println("== 列表准入 SQL(routeHasAssembly)==");
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT TOP 12 p.pl_no AS wo, p.pl_xc AS xc, ISNULL(p.[工艺路线],N'') AS route"
                        + " FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + AsmInspEntry.routeHasAssembly("p")
                        + " ORDER BY p.id DESC")) {
            System.out.println(r.get("wo") + "#" + r.get("xc") + " route=" + r.get("route"));
        }
        System.out.println("准入命中行数 = " + jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'"
                        + AsmInspEntry.routeHasAssembly("p"), Integer.class));

        // 5) ProcessFlow.EPS 可见性/口径自检(防止编译期引用被改名)
        System.out.println("EPS = " + ProcessFlow.EPS);
        Map<String, Object> one = new LinkedHashMap<>();
        one.put("ok", Boolean.TRUE);
        System.out.println(one);
    }
}
