import com.yinjia.mes.service.QcInspAutoService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;

/**
 * 商品「是否过程检验」开关 → 三张工序检验单自动出单的**只读探针**(2026-11-14)。
 *
 * <p>直接调用生产代码 {@link QcInspAutoService#build(long, String)}(报工审核 / 手机端报工吸收两个入口
 * 共用的同一份判定),按 {@code scjl.id} 打印:工单/工序/报工产品/商品开关值,以及本次会生成哪些检验单
 * (面板代号)或不生成的原因。**不写任何业务数据**(build 本身纯查询)。
 *
 * <p>用法(仓库根目录,先编译):
 * <pre>
 *   JDK=~/.jdks/ms-25.0.4
 *   CP="backend/target/classes:$(cat backend/target/cp.txt)"
 *   "$JDK/bin/javac" -encoding UTF-8 -cp "$CP" -d tools/archive/_inv-proc-insp-20261114/classes \
 *       tools/archive/_inv-proc-insp-20261114/ProcInspGateProbe.java
 *   "$JDK/bin/java" -Dstdout.encoding=UTF-8 -cp "tools/archive/_inv-proc-insp-20261114/classes:$CP" \
 *       ProcInspGateProbe HSDZ_MES_TEST 2258 1256 1254
 * </pre>
 *
 * @see QcInspAutoService 判据/单头组装唯一实现
 */
public class ProcInspGateProbe {
    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES_TEST";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        ds.setUrl("jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true");
        ds.setUsername("yinjia");
        ds.setPassword(pass);
        JdbcTemplate jdbc = new JdbcTemplate(ds);
        QcInspAutoService svc = new QcInspAutoService(jdbc);

        System.out.println("== DB=" + db + " ==");
        for (int i = 1; i < args.length; i++) {
            long id = Long.parseLong(args[i]);
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT s.id, ISNULL(s.gldh,N'') AS 工单号, ISNULL(s.gxdm,N'') AS 工序,"
                            + " ISNULL(s.wzdm,N'') AS 报工产品, ISNULL(s.sl,0) AS 数量,"
                            + " (SELECT TOP 1 CAST(ISNULL(i.[是否过程检验],0) AS int) FROM dbo.bs_inv i"
                            + "   WHERE i.存货编码 = s.wzdm) AS 商品开关"
                            + " FROM dbo.scjl s WHERE s.id = ?", id);
            if (rows.isEmpty()) { System.out.println("scjl.id=" + id + " 不存在"); continue; }
            Map<String, Object> r = rows.get(0);
            QcInspAutoService.Result res = svc.build(id, "");
            StringBuilder drafts = new StringBuilder();
            for (QcInspAutoService.Draft d : res.drafts()) {
                if (drafts.length() > 0) drafts.append(',');
                drafts.append(d.panelCode());
            }
            System.out.println(String.format(
                    "scjl.id=%d 工单=%s 工序=%s 报工产品=%s 数量=%s 商品开关=%s | 草稿=[%s] 原因=%s",
                    id, r.get("工单号"), r.get("工序"), r.get("报工产品"), r.get("数量"), r.get("商品开关"),
                    drafts, res.reason()));
        }
    }
}
