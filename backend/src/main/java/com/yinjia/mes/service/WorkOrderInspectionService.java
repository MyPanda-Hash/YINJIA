package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 生产工序检验(首件 / 制程 / 组装成品)在「生产工序进度看板」上的**取数与判定**(2026-11-08)。
 *
 * <p>用户口径(2026-11-08):「生产进度条工单,进行到哪一步,那个环节会提示品质进行检验。
 * 订单完成状态合格绿色不合格红色」⇒ 看板要能把「这道工序该不该检、检了没有、结果合格不合格」
 * 直接显示在工序步骤上,并在已完工工单上给出合格/不合格的结论。
 *
 * <p><b>数据源与口径</b>(与「工单详情·追溯」的质检段同源,不另立一套):
 * <ul>
 *   <li>三张工序检验单:首件 {@code QC_FIRST_INSP}(成型)、制程 {@code QC_PROC_INSP}(成型)、
 *       组装成品 {@code QC_ASM_INSP}(组装)—— 出单口径见 {@link QcInspAutoService} 的 OP_PANELS;</li>
 *   <li>单据状态必须走 {@code yj_doc_status} 推导(三张头表的物理「单据状态」列实测全为 NULL,
 *       口径与面板列表一致:canceled→已作废 / stopped→已中止 / pending→审批中 / shr→已审核 / 否则草稿);</li>
 *   <li>不合格数量取明细汇总(首件/组装成品列名=「不合格数量」、制程=「不良数量」,逐表登记不得写死);
 *       合格数量 = 表头检验数量 − Σ不合格(与追溯一致:未检验不得凭空显示合格数);</li>
 *   <li><b>结果只认已审核单据</b> —— 草稿/审批中不算数;弃审后自动退回「待审核/待检验」,
 *       看板结果跟着回退(用户口径「完成之后生产进度条可看结果」)。</li>
 * </ul>
 *
 * <p><b>行归属</b>(与 {@link ProcessTaskService#detail} / 追溯质检段一致):①检验单头「工单行号」;
 * ②无行号时按报工单号反查该行已审核报工;③再按批次号;<b>不猜</b> —— 都不命中且该工单只有一行时才归到该行。
 *
 * <p>本类只读、不改任何业务数据。
 */
@Service
public class WorkOrderInspectionService {

    /** 一张工序检验单的取数口径(三张表同构,列名差异在此登记) */
    private record InspPanel(String panelCode, String label, String headTable, String detailTable, String ngColumn) { }

    /** 顺序 = 展示顺序(成型:首件→制程;组装:组装成品) */
    private static final List<InspPanel> PANELS = List.of(
            new InspPanel("QC_FIRST_INSP", "首件检验", "qc_first_insp_head", "qc_first_insp_detail", "不合格数量"),
            new InspPanel("QC_PROC_INSP", "制程检验", "qc_proc_insp_head", "qc_proc_insp_detail", "不良数量"),
            new InspPanel("QC_ASM_INSP", "组装成品检验", "qc_asm_insp_head", "qc_asm_insp_detail", "不合格数量"));

    /** 应检工序 → 该工序的检验类型(与 {@link QcInspAutoService} 的 OP_PANELS 同源;改口径只改这里) */
    private static final Map<String, List<String>> OP_TYPES = new LinkedHashMap<>();

    static {
        OP_TYPES.put("成型", List.of("首件检验", "制程检验"));
        OP_TYPES.put("组装", List.of("组装成品检验"));
    }

    private final JdbcTemplate jdbc;

    public WorkOrderInspectionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 批量取检验单并按**工单行**归属。
     *
     * @param boardRows 看板行(需含 工单号/工单行号/行id/批次号)
     * @return 行 id(plang.id) → 该行检验单(含已作废单,排序:有效单在前、按类型顺序)
     */
    public Map<Long, List<Map<String, Object>>> docsByRow(List<Map<String, Object>> boardRows) {
        Map<Long, List<Map<String, Object>>> out = new HashMap<>();
        if (boardRows == null || boardRows.isEmpty()) return out;

        // 工单号 → 该单的行;行id → 行
        Map<String, List<Map<String, Object>>> byNo = new LinkedHashMap<>();
        Map<Long, Map<String, Object>> byId = new HashMap<>();
        Set<String> nos = new LinkedHashSet<>();
        for (Map<String, Object> r : boardRows) {
            String no = nz(str(r.get("工单号")));
            if (no.isEmpty()) continue;
            nos.add(no);
            byNo.computeIfAbsent(no, k -> new ArrayList<>()).add(r);
            long id = (long) num(r.get("行id"));
            if (id > 0) byId.put(id, r);
        }
        if (nos.isEmpty()) return out;
        Object[] noArgs = nos.toArray();
        String in = marks(nos.size());

        // ① 报工单号 → 行(检验单无行号的老数据按它回落)
        Map<Long, Set<String>> rowReports = new HashMap<>();
        for (Map<String, Object> q : jdbc.queryForList(
                "SELECT s.gldh AS 工单号, ISNULL(pc.plang_id,0) AS 行id, ISNULL(s.[工单行号],0) AS 行号,"
                        + " ISNULL(s.[批次号],N'') AS 批次号, ISNULL(s.报工单号,N'') AS 报工单号"
                        + " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " WHERE s.gldh IN (" + in + ") AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(s.报工单号,N'')<>N''"
                        + " GROUP BY s.gldh, ISNULL(pc.plang_id,0), ISNULL(s.[工单行号],0),"
                        + "          ISNULL(s.[批次号],N''), ISNULL(s.报工单号,N'')", noArgs)) {
            Long rowId = attribute(byNo, byId, nz(str(q.get("工单号"))), (long) num(q.get("行id")),
                    (int) num(q.get("行号")), nz(str(q.get("批次号"))));
            String scNo = nz(str(q.get("报工单号")));
            if (rowId != null && !scNo.isEmpty()) rowReports.computeIfAbsent(rowId, k -> new HashSet<>()).add(scNo);
        }

        // ② 三张检验单
        for (InspPanel p : PANELS) {
            for (Map<String, Object> d0 : rawDocs(p, noArgs)) {
                Map<String, Object> d = new LinkedHashMap<>(d0);
                d.put("检验类型", p.label());
                d.put("检验工序", opOfType(p.label()));
                List<Long> targets = targetsOf(d, byNo, byId, rowReports);
                for (Long rowId : targets) {
                    List<Map<String, Object>> list = out.computeIfAbsent(rowId, k -> new ArrayList<>());
                    list.add(d);
                }
            }
        }
        // 每行排序:有效单在前(按状态、再按类型顺序)
        List<String> typeOrder = new ArrayList<>();
        for (List<String> ts : OP_TYPES.values()) typeOrder.addAll(ts);
        for (List<Map<String, Object>> list : out.values()) {
            list.sort((a, b) -> {
                int ia = typeOrder.indexOf(String.valueOf(a.get("检验类型")));
                int ib = typeOrder.indexOf(String.valueOf(b.get("检验类型")));
                if (ia != ib) return Integer.compare(ia < 0 ? 99 : ia, ib < 0 ? 99 : ib);
                return String.valueOf(a.get("检验单号")).compareTo(String.valueOf(b.get("检验单号")));
            });
        }
        return out;
    }

    /** 单行:把检验信息套进工序步骤(写 step.检验)并在 row 上写 质检状态/待检验工序/质检汇总 */
    @SuppressWarnings("unchecked")
    public void attach(Map<String, Object> row, List<Map<String, Object>> steps, List<Map<String, Object>> docs) {
        List<Map<String, Object>> valid = new ArrayList<>();
        for (Map<String, Object> d : docs == null ? List.<Map<String, Object>>of() : docs) {
            String st = nz(str(d.get("单据状态")));
            if (!("已作废".equals(st) || "已中止".equals(st))) valid.add(d);
        }

        List<String> expectedOps = new ArrayList<>();
        List<String> existedOps = new ArrayList<>();
        List<String> waitOps = new ArrayList<>();
        boolean anyNg = false;
        boolean anyPending = false;
        boolean allPass = true;

        for (Map<String, Object> step : steps) {
            String op = nz(str(step.get("工序")));
            List<String> types = OP_TYPES.get(op);
            if (types == null) continue;                 // 非应检工序(切炭/装箱/混料…)不显示检验
            expectedOps.add(op);

            List<Map<String, Object>> docsOp = new ArrayList<>();
            for (Map<String, Object> d : valid) {
                if (op.equals(nz(str(d.get("检验工序"))))) docsOp.add(d);
            }
            if (!docsOp.isEmpty()) existedOps.add(op);

            List<Map<String, Object>> audited = new ArrayList<>();
            boolean ngStep = false;
            for (Map<String, Object> d : docsOp) {
                if (!"已审核".equals(nz(str(d.get("单据状态"))))) continue;
                if (isNg(d)) { ngStep = true; anyNg = true; }
                else if (isPass(d)) audited.add(d);
            }
            double done = num(step.get("完工量"));

            String st;
            if (ngStep) st = "不合格";
            // 「未开始」= 这道工序还没有任何产出(报工量=0)且没有检验单 —— 此时不该提示品质(还没东西可检);
            // 一旦有产出(哪怕只报了一部分,如首件/首批)而检验没完成 ⇒ 待检验/待审核,提示品质。
            else if (docsOp.isEmpty()) st = done > 0 ? "待检验" : "未开始";
            else if (audited.size() == docsOp.size()) st = "合格";
            else if (hasPending(docsOp)) { st = "待审核"; anyPending = true; }
            else st = "待检验";

            if (!"合格".equals(st)) allPass = false;

            Map<String, Object> insp = new LinkedHashMap<>();
            insp.put("应检", true);
            insp.put("类型", types);
            insp.put("状态", st);
            // 品质提示:该工序已有产出、但检验还没完成(缺单/草稿/审批中)⇒ 提示品质去检验
            boolean prompt = ("待检验".equals(st) || "待审核".equals(st)) && done > 0;
            insp.put("提示", prompt ? "待品质检验" : "");
            if (prompt) waitOps.add(op);
            insp.put("单据数", docsOp.size());
            int auditedCnt = 0;
            for (Map<String, Object> d : docsOp) if ("已审核".equals(nz(str(d.get("单据状态"))))) auditedCnt++;
            insp.put("已审核数", auditedCnt);
            List<Map<String, Object>> docList = new ArrayList<>();
            for (Map<String, Object> d : docsOp) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("检验单号", d.get("检验单号"));
                m.put("检验类型", d.get("检验类型"));
                m.put("单据状态", d.get("单据状态"));
                m.put("结论", isNg(d) ? "不合格" : (isPass(d) ? "合格" : "待检验"));
                m.put("检验数量", d.get("检验数量"));
                m.put("不合格数量", d.get("不合格数量"));
                m.put("检验员", d.get("检验员"));
                m.put("单据日期", d.get("单据日期"));
                docList.add(m);
            }
            insp.put("单据", docList);
            step.put("检验", insp);
        }

        // ── 行级质检汇总(与追溯「质检数据」同口径:应检 = 成型/组装;已检 = 出过单;缺检 = 差集) ──
        List<String> missOps = new ArrayList<>();
        for (String op : expectedOps) if (!existedOps.contains(op)) missOps.add(op);
        double inspQty = 0, passQty = 0, ngQty = 0;
        int auditedAll = 0;
        for (Map<String, Object> d : valid) {
            if (!"已审核".equals(nz(str(d.get("单据状态"))))) continue;
            auditedAll++;
            double q = num(d.get("检验数量"));
            double ng = num(d.get("不合格数量"));
            inspQty += q;
            ngQty += ng;
            if (!isNg(d)) passQty += Math.max(q - ng, 0);
        }
        Map<String, Object> sum = new LinkedHashMap<>();
        sum.put("应检工序", expectedOps);
        sum.put("已检工序", existedOps);
        sum.put("缺检工序", missOps);
        sum.put("检验单数", valid.size());
        sum.put("已审核数", auditedAll);
        sum.put("检验数量合计", round(inspQty));
        sum.put("合格数量合计", round(passQty));
        sum.put("不合格数量合计", round(ngQty));
        sum.put("结论", anyNg ? "存在不合格"
                : (inspQty <= 0 ? "未检验" : (!missOps.isEmpty() ? "缺检" : "全部合格")));

        String qcState;
        if (expectedOps.isEmpty()) qcState = "无需检验";
        else if (anyNg) qcState = "不合格";
        else if (allPass && expectedOps.size() == existedOps.size()) qcState = "合格";
        else if (anyPending) qcState = "检验中";
        else qcState = "待检验";

        row.put("质检状态", qcState);
        row.put("待检验工序", waitOps);
        row.put("质检汇总", sum);
    }

    // ─────────────────────────── 内部工具 ───────────────────────────

    private List<Map<String, Object>> rawDocs(InspPanel p, Object[] noArgs) {
        return jdbc.queryForList(
                "SELECT h.单据编号 AS 检验单号, ISNULL(h.工单号,N'') AS 工单号,"
                        + " ISNULL(h.工序,N'') AS 工序, ISNULL(h.[工单行号],0) AS 行号,"
                        + " ISNULL(h.[批次号],N'') AS 批次号, ISNULL(h.报工单号,N'') AS 报工单号,"
                        + " ISNULL(h.总结论,N'') AS 总结论, ISNULL(h.检验数量,0) AS 检验数量,"
                        + " ISNULL((SELECT SUM(ISNULL(d.[" + p.ngColumn() + "],0)) FROM dbo." + p.detailTable()
                        + "   d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'),0) AS 不合格数量,"
                        + " CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
                        + "      WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                        + "      WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'"
                        + "      WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,"
                        + " ISNULL(h.检验员,N'') AS 检验员,"
                        + " CONVERT(varchar(10), h.单据日期, 120) AS 单据日期"
                        + " FROM dbo." + p.headTable() + " h"
                        + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code=? AND s.doc_no = h.单据编号"
                        + " WHERE h.工单号 IN (" + marks(noArgs.length) + ") AND ISNULL(h.asp_cancel,'N')<>'Y'",
                appendPanel(p.panelCode(), noArgs));
    }

    /** 一张检验单归到哪(可能)几个工单行:①工单行号 ②报工单号 ③批次号 ④单行工单兜底 */
    private static List<Long> targetsOf(Map<String, Object> d, Map<String, List<Map<String, Object>>> byNo,
                                        Map<Long, Map<String, Object>> byId, Map<Long, Set<String>> rowReports) {
        List<Long> out = new ArrayList<>();
        String no = nz(str(d.get("工单号")));
        List<Map<String, Object>> rows = byNo.getOrDefault(no, List.of());
        if (rows.isEmpty()) return out;
        int xc = (int) num(d.get("行号"));
        String scNo = nz(str(d.get("报工单号")));
        String batch = nz(str(d.get("批次号")));
        if (xc > 0) {
            for (Map<String, Object> r : rows) {
                if ((long) num(r.get("工单行号")) == xc) {
                    Long id = (long) num(r.get("行id"));
                    if (id > 0) out.add(id);
                    break;
                }
            }
            return out;
        }
        if (!scNo.isEmpty()) {
            for (Map<String, Object> r : rows) {
                Long id = (long) num(r.get("行id"));
                Set<String> reps = rowReports.getOrDefault(id, Set.of());
                if (reps.contains(scNo)) out.add(id);
            }
            if (!out.isEmpty()) return out;
        }
        if (!batch.isEmpty()) {
            for (Map<String, Object> r : rows) {
                if (batch.equals(nz(str(r.get("批次号"))))) {
                    Long id = (long) num(r.get("行id"));
                    if (id > 0) out.add(id);
                }
            }
            if (!out.isEmpty()) return out;
        }
        // 都不命中:只有该工单仅一行时才敢挂(不猜)
        if (rows.size() == 1) {
            Long id = (long) num(rows.get(0).get("行id"));
            if (id > 0) out.add(id);
        }
        return out;
    }

    private static Long attribute(Map<String, List<Map<String, Object>>> byNo, Map<Long, Map<String, Object>> byId,
                                  String no, long rid, int xc, String batch) {
        if (rid > 0 && byId.containsKey(rid)) return rid;
        List<Map<String, Object>> rows = byNo.getOrDefault(no, List.of());
        if (xc > 0) {
            for (Map<String, Object> r : rows) if ((long) num(r.get("工单行号")) == xc) return (long) num(r.get("行id"));
        }
        if (!batch.isEmpty()) {
            for (Map<String, Object> r : rows) if (batch.equals(nz(str(r.get("批次号"))))) return (long) num(r.get("行id"));
        }
        return rows.size() == 1 ? (long) num(rows.get(0).get("行id")) : null;
    }

    /** 已审核单是否判不合格:总结论=不合格,或明细不合格数量 > 0 */
    private static boolean isNg(Map<String, Object> d) {
        return "不合格".equals(nz(str(d.get("总结论")))) || num(d.get("不合格数量")) > 0;
    }

    /** 已审核单是否算「检验合格/已检」:无不合格 且 (总结论=合格 或 检验数量>0 —— 空壳已审核单不算) */
    private static boolean isPass(Map<String, Object> d) {
        if (isNg(d)) return false;
        return "合格".equals(nz(str(d.get("总结论")))) || num(d.get("检验数量")) > 0;
    }

    private static boolean hasPending(List<Map<String, Object>> docs) {
        for (Map<String, Object> d : docs) {
            String st = nz(str(d.get("单据状态")));
            if ("草稿".equals(st) || "审批中".equals(st)) return true;
        }
        return false;
    }

    private static String opOfType(String type) {
        for (Map.Entry<String, List<String>> e : OP_TYPES.entrySet()) {
            if (e.getValue().contains(type)) return e.getKey();
        }
        return "";
    }

    private static Object[] appendPanel(String panelCode, Object[] noArgs) {
        Object[] out = new Object[noArgs.length + 1];
        out[0] = panelCode;
        System.arraycopy(noArgs, 0, out, 1, noArgs.length);
        return out;
    }

    private static String marks(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(',');
            sb.append('?');
        }
        return sb.toString();
    }

    private static double round(double v) { return Math.round(v * 10000d) / 10000d; }

    private static String nz(String s) { return s == null ? "" : s; }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() || "null".equals(s) ? null : s;
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
