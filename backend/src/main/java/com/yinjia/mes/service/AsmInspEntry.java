package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 「工单行是否**已进入组装/装箱环节**」的唯一判定口径(2026-11-12 用户口径)。
 *
 * <h3>用户口径(原话)</h3>
 * <pre>
 *   「出货表观在组装/装箱环节就要进行检验。当前实现的还是自动生成单据对吧,修改当前生成出货表观的
 *     生成时间,在进入到组装/装箱这个工序或者产线的时候就生成这个出货表观的表单。」
 * </pre>
 * 原 {@link QcInspAutoService} 只在「组装累计已报工 ≥ 该道计划量」时出单 ⇒ 等于**组装做完**才有表观单,
 * 品质在组装/装箱工位手里没有纸。现改为「**进入该环节即出单**」;判据集中在本类,
 * 自动出单({@link QcInspAutoService})与手工「选生产工单」({@code QcAsmInspController})共用。
 *
 * <h3>「已进入」判据(全部是既有口径,不另立一套)</h3>
 * <ol>
 *   <li><b>工序</b>:路线里「组装」或「装箱」那道,前道有量流下来 ——
 *       {@link ProcessFlow.Step#availBase()} &gt; 0(可加工量折成品 &gt; 0,即台账「已落实」);</li>
 *   <li><b>该道自己已在报工/已完成</b>:{@link ProcessFlow.Step#done()} &gt; 0 ——
 *       兜「手机端直写/存量数据跳过前道直接报组装」的行(原来按「达计划量」判,现在一有报工就算进入);</li>
 *   <li><b>产线</b>:工单行当前线({@code plang.scx})或该道台账已落的**实际生产线**属于「组装」车间
 *       (装箱归组装,见 {@code ProcessShop};⚠ 只看**实际**线,不看预排的**计划**线 ——
 *        排产时每道都预计划线,拿它判会让整批未生产的单在排产那一刻就出表观单)。</li>
 * </ol>
 * 任一条成立即「已进入」。
 *
 * <h3>取数为什么分单行/批量两套</h3>
 * <ul>
 *   <li>{@link #of} 单行:走 {@link ProcessFlow#steps}(逐道 {@link WoInspGate#reportedQty},最权威)
 *       —— 自动出单触发面用它,一行一次,不是性能瓶颈;</li>
 *   <li>{@link #checkPage} 批量:走 {@link ProcessFlow#batchSteps}(3 条批量查询,与行数无关)
 *       —— 「选生产工单」弹窗一页 20 行,逐行查库会明显变慢(与 2026-11-12 列表口径同一教训)。</li>
 * </ul>
 */
public final class AsmInspEntry {

    private AsmInspEntry() {}

    /** 组装环节的工序名(装箱归组装车间;与 {@code bs_route.工序名称} / {@code scjl.gxdm} 同一份字典值) */
    public static final List<String> OPS = List.of("组装", "装箱");

    /** 未进入时的拦截话术(前端 {@code tt()} 用同一句原文;改文案只改这里) */
    public static final String REASON_NOT_ENTERED =
            "该工单行尚未进入组装/装箱工序（上一道工序还没有已审核报工流入），暂不能生成出货检验表观";

    /** 路线里压根没有组装/装箱工序时的话术(这类工单历史上就不出表观单,不是"还没进入") */
    public static final String REASON_NO_ASSEMBLY_OP =
            "该工单的工艺路线里没有「组装/装箱」工序，不出出货检验表观";

    /**
     * 判定结果。
     *
     * @param entered 是否已进入组装/装箱
     * @param op      命中的工序(组装/装箱;未进入时为空串)
     * @param avail   该道可加工量(工序口径;>0 即前道已流入)
     * @param done    该道已审报工量(工序口径)
     * @param line    该道的实际生产线(台账实际线优先,取不到回落工单行当前线)
     * @param reason  未进入时的话术(已进入为空串)
     */
    public record Status(boolean entered, String op, double avail, double done, String line, String reason) {}

    private static Status no(String reason) {
        return new Status(false, "", 0, 0, "", reason);
    }

    /**
     * **单行判定**(自动出单钩子 / 建单前硬校验用)。
     *
     * @param rowId {@code plang.id}(工单行 id)
     */
    public static Status of(JdbcTemplate jdbc, long rowId) {
        if (jdbc == null || rowId <= 0) return no(REASON_NOT_ENTERED);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 行id, ISNULL(p.pl_no,N'') AS 工单号, ISNULL(p.pl_xc,0) AS 工单行号,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.[工艺路线],N'') AS 工艺路线"
                        + " FROM dbo.plang p WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'", rowId);
        if (rows.isEmpty()) return no(REASON_NOT_ENTERED);
        Map<String, Object> r = rows.get(0);
        List<ProcessFlow.Step> flow = ProcessFlow.steps(jdbc, str(r.get("工单号")), rowId,
                num(r.get("排产数量")), str(r.get("工艺路线")));
        Map<Long, Map<String, String>> lines = actualLines(jdbc, List.of(rowId));
        Set<String> asmShopLines = assemblyShopLines(jdbc, candidateLines(List.of(r), lines));
        return judge(flow, str(r.get("生产线")), lines.getOrDefault(rowId, Map.of()), asmShopLines);
    }

    /**
     * **批量判定**(「选生产工单」弹窗一页 N 行用;3 条批量查询 + 1 条产线车间查询)。
     *
     * <p>⚠ 入参行需带:{@code 行id}、{@code 排产数量}、{@code 工艺路线}、{@code 工单号}、{@code 工单行号}、
     * {@code 生产线}(与 {@link ProcessFlow#batchSteps} 同要求)。
     *
     * @return 键 = {@link #key}(工单号, 工单行号) → 判定结果
     */
    public static Map<String, Status> checkPage(JdbcTemplate jdbc, List<Map<String, Object>> rows) {
        Map<String, Status> out = new LinkedHashMap<>();
        if (jdbc == null || rows == null || rows.isEmpty()) return out;
        Map<Long, List<ProcessFlow.Step>> flows = ProcessFlow.batchSteps(jdbc, rows);
        if (flows.isEmpty()) return out;
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Object id = r.get("行id");
            if (id instanceof Number n) ids.add(n.longValue());
        }
        Map<Long, Map<String, String>> lines = actualLines(jdbc, ids);
        Set<String> asmShopLines = assemblyShopLines(jdbc, candidateLines(rows, lines));
        for (Map<String, Object> r : rows) {
            Object idObj = r.get("行id");
            if (!(idObj instanceof Number n)) continue;
            List<ProcessFlow.Step> flow = flows.get(n.longValue());
            if (flow == null || flow.isEmpty()) continue;
            out.put(key(str(r.get("工单号")), (int) num(r.get("工单行号"))),
                    // ⚠ 必须传**本行**的台账线:整页的 lines 混在一起会把别的行的「实际组装线」当成自己的
                    //   (2026-11-12 实测踩到:整页凡路线含装箱的行全被判成「已进入」)
                    judge(flow, str(r.get("生产线")), lines.getOrDefault(n.longValue(), Map.of()), asmShopLines));
        }
        return out;
    }

    /**
     * 「工艺路线里含组装/装箱」的布尔表达式(给「选生产工单」列表做准入过滤)。
     *
     * @param alias 外层 {@code dbo.plang} 别名(调用方固定传 {@code "p"})
     */
    public static String routeHasAssembly(String alias) {
        String p = alias == null || alias.isBlank() ? "p" : alias;
        return " AND EXISTS (SELECT 1 FROM dbo.bs_route r"
                + " WHERE r.工艺路线编码 = ISNULL(" + p + ".[工艺路线],N'')"
                + "   AND r.工序名称 IN (N'组装',N'装箱') AND ISNULL(r.asp_cancel,'N')<>'Y')";
    }

    public static String key(String wo, Integer xc) {
        return (wo == null ? "" : wo) + "#" + (xc == null ? 0 : xc);
    }

    // ────────────────────────────── 内部实现 ──────────────────────────────

    /**
     * 共用的判定:逐道看「量」,再看「产线」;都不成立给原因。
     *
     * @param flow         全道按量派生
     * @param curLine      工单行当前线(plang.scx)
     * @param rowLines     **本行**的(工序 → 台账实际生产线);批量判定时必须按行切分,不能传整页
     * @param asmShopLines 属于「组装」车间的产线名集合
     */
    private static Status judge(List<ProcessFlow.Step> flow, String curLine,
                                Map<String, String> rowLines, Set<String> asmShopLines) {
        if (flow == null || flow.isEmpty()) return no(REASON_NO_ASSEMBLY_OP);
        List<ProcessFlow.Step> asm = new ArrayList<>();
        for (ProcessFlow.Step s : flow) if (OPS.contains(s.op())) asm.add(s);
        if (asm.isEmpty()) return no(REASON_NO_ASSEMBLY_OP);
        boolean curLineAsm = asmShopLines.contains(curLine == null ? "" : curLine.trim());
        String firstFocus = asm.get(0).op();
        for (ProcessFlow.Step s : asm) {
            String actLine = lineOf(rowLines, s.op());
            // ① 前道已流入 / ② 本道已有已审报工 ⇒ 已进入(工序口径)
            if (s.availBase() > ProcessFlow.EPS || s.done() > ProcessFlow.EPS) {
                return new Status(true, s.op(), r4(s.avail()), r4(s.done()),
                        actLine.isEmpty() ? curLine : actLine, "");
            }
            // ③ 产线口径:该道台账已落的实际线 / 工单当前线属于组装车间(装箱归组装)
            if (asmShopLines.contains(actLine.trim()) || curLineAsm) {
                return new Status(true, s.op(), r4(s.avail()), r4(s.done()),
                        actLine.isEmpty() ? curLine : actLine, "");
            }
        }
        return new Status(false, firstFocus, 0, 0, "", REASON_NOT_ENTERED);
    }

    /** 本次判定要查车间的产线名(工单当前线 + 台账实际线) */
    private static Set<String> candidateLines(List<Map<String, Object>> rows, Map<Long, Map<String, String>> lines) {
        Set<String> out = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String line = str(r.get("生产线"));
            if (!line.isEmpty()) out.add(line);
        }
        for (Map<String, String> byOp : lines.values()) {
            for (String line : byOp.values()) if (line != null && !line.isBlank()) out.add(line.trim());
        }
        return out;
    }

    /** 这些产线里哪些属于「组装」车间 */
    private static Set<String> assemblyShopLines(JdbcTemplate jdbc, Set<String> lines) {
        Set<String> out = new LinkedHashSet<>();
        if (jdbc == null || lines == null || lines.isEmpty()) return out;
        StringBuilder in = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (String line : lines) {
            if (in.length() > 0) in.append(',');
            in.append('?');
            args.add(line);
        }
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 生产线 AS line, ISNULL(生产车间,N'') AS shop FROM dbo.bs_prod_line"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 生产线 IN (" + in + ")", args.toArray())) {
            // 装箱归组装:车间登记的就是「组装」(实测 装箱线/装箱1/装箱2 皆如此),故按车间名判,
            // 不另写「装箱」白名单 —— 将来新增的组装车间产线自动纳入。
            if (str(r.get("shop")).contains("组装")) out.add(str(r.get("line")));
        }
        return out;
    }

    /** 批量:工单行id → (工序 → 台账实际生产线);只取组装/装箱两道 */
    private static Map<Long, Map<String, String>> actualLines(JdbcTemplate jdbc, List<Long> ids) {
        Map<Long, Map<String, String>> out = new LinkedHashMap<>();
        if (jdbc == null || ids == null || ids.isEmpty()) return out;
        StringBuilder in = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) in.append(i == 0 ? "?" : ",?");
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工单行id AS pid, 工序 AS op, ISNULL(实际生产线,N'') AS line"
                        + " FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND 工单行id IN (" + in + ") AND 工序 IN (N'组装',N'装箱')"
                        + " ORDER BY ISNULL(工序序,999), id", ids.toArray())) {
            Object pid = r.get("pid");
            if (!(pid instanceof Number n)) continue;
            String op = str(r.get("op"));
            String line = str(r.get("line"));
            if (op.isEmpty() || line.isEmpty()) continue;
            out.computeIfAbsent(n.longValue(), k -> new LinkedHashMap<>()).putIfAbsent(op, line);
        }
        return out;
    }

    /** 本行某道工序的台账实际生产线(没有返回空串) */
    private static String lineOf(Map<String, String> rowLines, String op) {
        if (rowLines == null || rowLines.isEmpty() || op.isEmpty()) return "";
        String v = rowLines.get(op);
        return v == null ? "" : v.trim();
    }

    private static double r4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
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
