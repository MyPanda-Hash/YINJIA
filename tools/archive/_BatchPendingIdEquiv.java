import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.Map;

/**
 * _BatchPendingIdEquiv.java —— `BatchService.findPendingBatchId` 两种实现的**逐字对照**只读探针。
 *
 * 目的(补 commit 8cc1648f 未覆盖的那一半):证明 `form_flow_link.batch_id` **命中**时,
 *   旧实现(jdbc.queryForObject) 与 新实现(jdbc.queryForList + 取首行)
 *   对**同一张入库单、同一批行**返回**同一个 batch_id**;而 0 行时旧实现抛
 *   IncorrectResultSizeDataAccessException、新实现返回 null。
 *
 * 为什么不是"我认为等价":本探针用**真实 Spring 类**(org.springframework.jdbc.core.JdbcTemplate,
 * 与应用同一版本 6.2.8)+ 与生产**逐字相同**的 SQL 与三档兜底顺序,在真实库上跑两遍。
 *
 * 用法(依赖 jar 目录 = 应用 fat jar 里 BOOT-INF/lib 解出来的目录,或任何含 spring-jdbc/mssql-jdbc 的目录):
 *   java -cp "<libDir>\*" tools/archive/_BatchPendingIdEquiv.java HSDZ_MES_TEST <入库单号> [更多单号...]
 * 只读:只跑 SELECT,不写任何库。
 */
public class _BatchPendingIdEquiv {

    private static final String KEY_COL = "批次键";

    private final JdbcTemplate jdbc;

    _BatchPendingIdEquiv(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    // ─────────── 旧实现:第二档用 jdbc.queryForObject(8cc1648f 之前) ───────────
    int findOld(String panelCode, String docNo) {
        if (!"PURCHASE_IN".equals(panelCode) || docNo == null || docNo.isBlank()) return 0;
        Integer id = jdbc.queryForObject("SELECT TOP 1 [" + KEY_COL + "] FROM bd_purchase_in WHERE 单据编号 = ?",
                Integer.class, docNo);
        if (id != null && id > 0) return id;
        Integer linked = jdbc.queryForObject("SELECT TOP 1 batch_id FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
                + " AND target_form_no=? AND batch_id IS NOT NULL ORDER BY id", Integer.class, docNo);
        if (linked != null && linked > 0) return linked;
        return third(docNo);
    }

    // ─────────── 新实现:第二档用 jdbc.queryForList 取首行(现行代码) ───────────
    int findNew(String panelCode, String docNo) {
        if (!"PURCHASE_IN".equals(panelCode) || docNo == null || docNo.isBlank()) return 0;
        Integer id = jdbc.queryForObject("SELECT TOP 1 [" + KEY_COL + "] FROM bd_purchase_in WHERE 单据编号 = ?",
                Integer.class, docNo);
        if (id != null && id > 0) return id;
        List<Integer> linked = jdbc.queryForList("SELECT TOP 1 batch_id FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
                + " AND target_form_no=? AND batch_id IS NOT NULL ORDER BY id", Integer.class, docNo);
        id = linked.isEmpty() ? null : linked.get(0);
        if (id != null && id > 0) return id;
        return third(docNo);
    }

    /** 第三档(两实现逐字相同):来源单头(qc_insp/sl_recv/qc_tc_in)的批次键 */
    private int third(String docNo) {
        List<Map<String, Object>> srces = jdbc.queryForList(
                "SELECT DISTINCT source_panel_code AS pc, source_form_no AS no FROM form_flow_link"
                        + " WHERE target_panel_code='PURCHASE_IN' AND target_form_no=?", docNo);
        for (Map<String, Object> s : srces) {
            String pc = String.valueOf(s.get("pc"));
            String table = switch (pc) {
                case "QC_INSP" -> "qc_insp";
                case "QC_RECV" -> "sl_recv";
                case "QC_TC_IN" -> "qc_tc_in";
                default -> null;
            };
            if (table == null) continue;
            try {
                List<Map<String, Object>> r = jdbc.queryForList(
                        "SELECT TOP 1 [" + KEY_COL + "] AS k FROM " + table + " WHERE 单据编号 = ?", s.get("no"));
                if (!r.isEmpty() && r.get(0).get("k") instanceof Number n && n.intValue() > 0) return n.intValue();
            } catch (Exception ignore) { /* 与生产同口径:不阻断 */ }
        }
        return 0;
    }

    /** 该单在 form_flow_link 里"第二档能查到几行"(给读数配上下文;单号不存在时也不能炸) */
    private String linkRows(String docNo) {
        try {
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
                    + " AND target_form_no=? AND batch_id IS NOT NULL", Integer.class, docNo);
            Integer all = jdbc.queryForObject("SELECT COUNT(*) FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
                    + " AND target_form_no=?", Integer.class, docNo);
            List<Object> hk = jdbc.queryForList("SELECT TOP 1 [" + KEY_COL + "] FROM bd_purchase_in WHERE 单据编号 = ?",
                    Object.class, docNo);
            Object headKey = hk.isEmpty() ? "(无此单)" : hk.get(0);
            return "链路行 " + all + " 条(batch_id 非空 " + n + " 条), 入库单头批次键=" + headKey;
        } catch (Exception e) {
            return "上下文查询失败:" + e.getClass().getSimpleName();
        }
    }

    private static String call(java.util.function.IntSupplier f) {
        try { return String.valueOf(f.getAsInt()); }
        catch (Exception e) { return "抛异常 " + e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage()).replaceAll("\\s+", " "); }
    }

    public static void main(String[] args) {
        if (args.length < 2) { System.err.println("用法: java -cp \"<libDir>\\*\" _BatchPendingIdEquiv.java <DB> <入库单号...>"); System.exit(2); }
        String db = args[0];
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        ds.setUrl("jdbc:sqlserver://localhost:1433;databaseName=" + db + ";encrypt=false;trustServerCertificate=true");
        ds.setUsername("yinjia");
        ds.setPassword("Yinjia@2026");
        _BatchPendingIdEquiv p = new _BatchPendingIdEquiv(new JdbcTemplate(ds));
        System.out.println("DB=" + db + "  spring-jdbc=" + JdbcTemplate.class.getPackage().getImplementationVersion()
                + "  (逐字对照:旧=queryForObject / 新=queryForList+首行)");
        int diff = 0;
        for (int i = 1; i < args.length; i++) {
            String doc = args[i];
            String oldV = call(() -> p.findOld("PURCHASE_IN", doc));
            String newV = call(() -> p.findNew("PURCHASE_IN", doc));
            boolean same = oldV.equals(newV);
            // 语义等价:两边都"可用值且相等",或(旧=0行抛 EmptyResultDataAccessException)且(新=0)
            boolean equivalent = same || (oldV.startsWith("抛异常 EmptyResultDataAccessException") && newV.equals("0"));
            if (!equivalent) diff++;
            System.out.printf("doc=%-22s %s | 旧(queryForObject)=%-58s 新(queryForList)=%-6s |%s%n",
                    doc, p.linkRows(doc), oldV, newV, equivalent ? (same ? " 相同" : " 0行:旧抛异常/新返回 0(8cc1648f 的差异面)") : " **不同**");
        }
        System.out.println(diff == 0 ? "结论:本次全部样本 两实现等价(命中同值;0 行仅旧实现抛异常)" : "结论:**发现不等价样本 " + diff + " 个 -> 需重新评审 8cc1648f**");
        System.exit(diff == 0 ? 0 : 1);
    }
}
