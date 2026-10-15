import com.yinjia.mes.service.WorkOrderCompletionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.*;

/** Direct TEST-ledger integration regression; all fixtures roll back, including on assertion failure.
 * From repository root after mvn package:
 * $cp='backend/target/classes;backend/target/dependency/*'
 * java -cp $cp tools/archive/_CompletionDetailRegression.java
 * Populate dependencies: mvn -f backend/pom.xml dependency:copy-dependencies -DoutputDirectory=target/dependency
 */
class _CompletionDetailRegression {
    private static JdbcTemplate jdbc;
    private static String no;
    private static int seq;

    public static void main(String[] args) throws Exception {
        String pass = System.getenv("YINJIA_SQL_PASS");
        if (pass == null || pass.isBlank()) throw new IllegalStateException("YINJIA_SQL_PASS is required");
        String host = Optional.ofNullable(System.getenv("YINJIA_SQL_HOST")).orElse("127.0.0.1:1433");
        String user = Optional.ofNullable(System.getenv("YINJIA_SQL_USER")).orElse("yinjia");
        String url = "jdbc:sqlserver://" + host
                + ";databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true";
        no = "CD-" + UUID.randomUUID().toString().substring(0, 8);
        try (Connection c = DriverManager.getConnection(url, user, pass)) {
            c.setAutoCommit(false);
            try {
                jdbc = new JdbcTemplate(new SingleConnectionDataSource(c, true));
                check("HSDZ_MES_TEST".equals(jdbc.queryForObject("SELECT DB_NAME()", String.class)), "TEST only");
                run();
            } finally {
                c.rollback();
                System.out.println("TEST fixtures rolled back");
            }
        }
    }

    private static void run() {
        WorkOrderCompletionService service = new WorkOrderCompletionService(jdbc);
        long a = order(1, "SHARED"), b = order(2, "SHARED"), unique = order(3, "UNIQUE");
        long pcA = schedule(a, 1), pcB = schedule(b, 2);
        long anchor = report(pcA, 2, "SHARED", "Y", "N", "切炭", 10); // anchor overrides stale line
        long anotherOp = report(pcA, 1, "SHARED", "Y", "N", "成型", 7);
        long otherRow = report(pcB, 1, "SHARED", "Y", "N", "切炭", 90);
        report(pcA, 1, "SHARED", null, "N", "切炭", 100); // draft
        report(pcA, 1, "SHARED", "Y", "Y", "切炭", 200); // cancelled
        report((long) Integer.MAX_VALUE, 1, "SHARED", "Y", "N", "切炭", 300); // dangling anchor: no fallback
        long byLine = report(0L, 1, "SHARED", "Y", "N", "切炭", 2);
        long nullAnchor = report(null, 1, null, "Y", "N", "切炭", 3);
        report(0L, null, "SHARED", "Y", "N", "切炭", 400); // ambiguous batch
        report(null, null, "  ", "Y", "N", "切炭", 500); // blank batch
        report(0L, 999, "UNIQUE", "Y", "N", "切炭", 600); // line must not fall through
        report(0L, 1, "UNIQUE", "Y", "N", "切炭", 700); // conflicting batch
        long batch = report(null, null, "UNIQUE", "Y", "N", "切炭", 4);
        expectIds(service.completionDetails(no, a), anchor, anotherOp, byLine, nullAnchor);
        expectIds(service.completionDetails(no, b), otherRow);
        expectIds(service.completionDetails(no, unique), batch);
        Map<String, Object> result = service.completionDetails(no, a);
        Map<String, Double> sums = new HashMap<>();
        for (Map<String, Object> r : rows(result, "工序汇总")) {
            sums.put((String) r.get("工序"), ((Number) r.get("完成数量")).doubleValue());
            int count = ((Number) r.get("记录数")).intValue();
            check(count == ("切炭".equals(r.get("工序")) ? 3 : 1), "per-process record count");
        }
        check(sums.equals(Map.of("切炭", 15.0, "成型", 7.0)), "per-process sums, no cross-process total");
        Map<String, Object> detail = rows(result, "明细").get(0);
        for (String key : List.of("id", "报工单号", "工单号", "工单行号", "工序", "批次号", "生产线",
                "产品编码", "产品名称", "规格型号", "单位", "完成数量", "计划数量", "报工人", "报工时间",
                "完工时间", "产成品流水号", "入库单号", "收敛口径")) check(detail.containsKey(key), key);
        check("fixture-user".equals(detail.get("报工人")), "blank ywman falls back to asp_user1");
        check(((Number) detail.get("工单行号")).intValue() == 1, "resolved line, not stale mirror");
        reject(() -> service.completionDetails(no + "-wrong", a));
        jdbc.update("UPDATE dbo.plang SET asp_cancel='Y' WHERE id=?", a);
        reject(() -> service.completionDetails(no, a));
        jdbc.update("UPDATE dbo.plang SET asp_cancel='N' WHERE id=?", a);
        // Duplicate line numbers require a nonempty batch to disambiguate; empty batch must not guess.
        long duplicate = order(1, "DIFFERENT");
        long confirmed = report(0L, 1, "DIFFERENT", "Y", "N", "切炭", 5);
        expectIds(service.completionDetails(no, a), anchor, anotherOp, byLine);
        expectIds(service.completionDetails(no, duplicate), confirmed);
        // Same line + same batch is ambiguous too, even if the caller chose a physical id.
        long duplicateBatch = order(1, "SHARED");
        expectIds(service.completionDetails(no, a), anchor, anotherOp);
        expectIds(service.completionDetails(no, duplicateBatch));
        long empty = order(99, "EMPTY");
        expectIds(service.completionDetails(no, empty));
        check(rows(service.completionDetails(no, empty), "工序汇总").isEmpty(), "empty summary");
        System.out.println("PASS completion details: anchors, drafts, cancellation, line/batch ambiguity, sums, guards");
    }

    private static long order(int line, String batch) {
        return jdbc.queryForObject("INSERT dbo.plang(comm,pl_no,pl_xc,[批次号],mc,gg,asp_cancel)"
                + " OUTPUT INSERTED.id VALUES(N'YJ',?,?,?,N'fixture',N'spec','N')", Long.class, no, line, batch);
    }

    private static long schedule(long id, int line) {
        return jdbc.queryForObject("INSERT dbo.plang_pc(comm,pl_no,pl_xc,plang_id,asp_cancel)"
                + " OUTPUT INSERTED.id VALUES(N'YJ',?,?,?,'N')", Long.class, no, line, id);
    }

    private static long report(Long anchor, Integer line, String batch, String status, String cancelled,
                               String process, double qty) {
        String reportNo = no + "-" + (++seq);
        return jdbc.queryForObject("INSERT dbo.scjl(comm,sc_no,[报工单号],gldh,gd_id,[工单行号],[批次号],"
                + "wgzt,asp_cancel,gxdm,sl,pl_sl,ywman,asp_user1,asp_time1,wgsj,jc_no,post_no)"
                + " OUTPUT INSERTED.id VALUES(N'YJ',?,?,?,?,?,?,?,?,?,?,100,N'  ',N'fixture-user',"
                + "GETDATE(),GETDATE(),N'fixture-serial',N'fixture-receipt')", Long.class,
                reportNo, reportNo, no, anchor, line, batch, status, cancelled, process, qty);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Map<String, Object> result, String key) {
        return (List<Map<String, Object>>) result.get(key);
    }

    private static void expectIds(Map<String, Object> result, long... expected) {
        Set<Long> actual = new HashSet<>(), wanted = new HashSet<>();
        for (Map<String, Object> r : rows(result, "明细")) actual.add(((Number) r.get("id")).longValue());
        for (long id : expected) wanted.add(id);
        check(actual.equals(wanted) && rows(result, "明细").size() == expected.length,
                "expected=" + wanted + " actual=" + actual);
    }

    private static void reject(Runnable action) {
        try { action.run(); } catch (IllegalArgumentException expected) { return; }
        throw new AssertionError("invalid order identity accepted");
    }

    private static void check(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
    }
}
