import com.yinjia.mes.service.QcFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;

/**
 * 只读探针:直接实例化 QcFlowService 打 board(),验证「检验数据记录」并列节点与「两单都审完才入库」口径。
 * 用法: java -cp "backend/target/classes;backend/target/cp.txt" _scratch/_qc4/QcFlowProbe.java [db] [keyword]
 */
public class QcFlowProbe {
    public static void main(String[] args) {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String kw = args.length > 1 ? args[1] : "";
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        ds.setUrl("jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true");
        ds.setUsername("yinjia");
        ds.setPassword("Yinjia@2026");
        QcFlowService svc = new QcFlowService(new JdbcTemplate(ds));
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("状态", "全部");
        body.put("limit", 800);
        body.put("含已隐藏", true);
        if (!kw.isBlank()) body.put("keyword", kw);
        Map<String, Object> out = svc.board(body);
        System.out.println("汇总 = " + out.get("汇总"));
        List<Map<String, Object>> rows = (List<Map<String, Object>>) out.get("行");
        System.out.println("行数 = " + rows.size());
        int withRec = 0, recApproved = 0, stageInsp = 0;
        for (Map<String, Object> r : rows) {
            String rec = s(r.get("检验数据记录单号"));
            String st = s(r.get("检验数据记录状态"));
            if (!rec.isEmpty()) withRec++;
            if ("已审核".equals(st)) recApproved++;
            if ("检验".equals(s(r.get("当前环节")))) stageInsp++;
            if (rows.indexOf(r) < 12) {
                System.out.printf("  %s | %s | 检验=%s(%s) | 记录=%s(%s) | 入库=%s(%s) | 环节=%s | 需检=%s%n",
                        s(r.get("送料暂收单号")), s(r.get("物料编码")),
                        s(r.get("检验单号")), s(r.get("检验状态")),
                        rec.isEmpty() ? "-" : rec, st.isEmpty() ? "-" : st,
                        s(r.get("入库单号")), s(r.get("入库状态")), s(r.get("当前环节")), s(r.get("需检验")));
            }
        }
        System.out.println("有记录行数 = " + withRec + " / 记录已审核 = " + recApproved + " / 当前环节=检验 = " + stageInsp);
        // 抽查:记录已审核但环节仍是「检验」的行(应该只剩「检验单没审完」那种)
        int bad = 0;
        for (Map<String, Object> r : rows) {
            if ("已审核".equals(s(r.get("检验数据记录状态"))) && "已审核".equals(s(r.get("检验状态")))
                    && !"检验".equals(s(r.get("当前环节"))) == false
                    && "检验".equals(s(r.get("当前环节"))) && s(r.get("特采单号")).isEmpty()) {
                // 检验单已审 + 记录已审,却还卡在检验 ⇒ 只可能是特采/退货之外的情况,列出来人工看
                if (s(r.get("退货单号")).isEmpty()) {
                    bad++;
                    if (bad <= 5) System.out.println("  [需人工确认] " + s(r.get("送料暂收单号")) + " 检验=" + s(r.get("检验状态"))
                            + " 记录=" + s(r.get("检验数据记录状态")) + " 环节=" + s(r.get("当前环节")));
                }
            }
        }
        System.out.println("两单均审完却仍显示待检验的行 = " + bad);
    }

    private static String s(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
