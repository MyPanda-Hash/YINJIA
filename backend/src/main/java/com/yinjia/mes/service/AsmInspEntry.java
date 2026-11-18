package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 「工单行是否**已进入末道工序**」的唯一判定口径(2026-11-18 修订)。
 *
 * <h3>用户口径(原话)</h3>
 * <pre>
 *   「这个出货检验表观应该修改为进入末道工序的就能在这里被选择」
 *   (并明确:出门功能检验 / 首件检验的选择工单**不修改**,只改出货检验表观)
 * </pre>
 * 2026-11-12 那版把准入写死成「进入**组装/装箱**那两道」,实际工艺路线的末道工序名称并不统一:
 * <ul>
 *   <li>{@code GY-CB-STD 炭棒标准路线}:成型 → 切炭 → <b>组装</b>;</li>
 *   <li>{@code GY-2026-11-0001}:成型 → <b>装箱</b>;</li>
 *   <li>{@code GY-2026-11-0003}:成型 → <b>组装装箱</b>(一个合并工序名,原判据既不在
 *       {@link #OPS} 也不被 {@code routeHasAssembly} 的 {@code IN (N'组装',N'装箱')} 命中
 *       ⇒ 这类工单行在弹窗里**根本不出现**,现场只能走强制开单);</li>
 *   <li>{@code GY-2026-10-0006}:成型 → 切炭 → 组装 → <b>装箱</b>。</li>
 * </ul>
 * 现改为按「**末道工序**」判:{@link #lastOp} 解析本行工艺路线的末道工序(优先取
 * {@code bs_route.是否末道工序} 标记的那道,没标记则取 {@code 加工顺序} 最后一道),
 * 该道是「组装/装箱类」且**已进入**即算通过 —— 与工序具体叫「组装」「装箱」还是「组装装箱」无关。
 *
 * <h3>「已进入」判据(沿用 2026-11-12 三条,只是焦点从"组装/装箱两道"收窄到"末道一道")</h3>
 * <ol>
 *   <li><b>量流进来</b>:{@link ProcessFlow.Step#availBase()} &gt; 0(上一道已审报工折成品流下来的,
 *       即台账「已落实」);</li>
 *   <li><b>本道已报工</b>:{@link ProcessFlow.Step#done()} &gt; 0(兜手机端直写/存量跨序);</li>
 *   <li><b>产线</b>:该道台账已落的**实际生产线**或工单行当前线属「组装」车间(装箱归组装,
 *       见 {@link ProcessShop};⚠ 只看实际线,不看排产时的**计划**线)。</li>
 * </ol>
 *
 * <h3>为什么还保留「末道必须是组装/装箱类」</h3>
 * 末道是「切炭」这类的半成品路线不出出货检验表观(历史口径未变,只是判据从"路线含组装/装箱"
 * 换成"路线**末道**是组装/装箱类");这类工单行不进「选生产工单」列表,自动出单同样跳过。
 *
 * <h3>取数为什么分单行/批量两套</h3>
 * <ul>
 *   <li>{@link #of} 单行:走 {@link ProcessFlow#steps}(逐道 {@link WoInspGate#reportedQty},最权威)
 *       —— 自动出单触发面用它,一行一次,不是性能瓶颈;</li>
 *   <li>{@link #checkPage} 批量:走 {@link ProcessFlow#batchSteps}(3 条批量查询,与行数无关)+ 1 条
 *       末道工序解析查询 —— 「选生产工单」弹窗一页 20 行,逐行查库会明显变慢
 *       (与 2026-11-12 列表口径同一教训)。</li>
 * </ul>
 */
public final class AsmInspEntry {

    private AsmInspEntry() {}

    /**
     * 组装/装箱类工序名(与 {@code bs_route.工序名称} / {@code scjl.gxdm} 同一份字典值)。
     *
     * <p>⚠ 真实数据里出现过**合并道**「组装装箱」({@code GY-2026-11-0003}) ⇒ 判据统一走
     * {@link #isAsmOp}(含「组装」或「装箱」即认),本清单只用于展示/老代码兜底,不要再用
     * {@code OPS.contains(op)} 当准入。
     */
    public static final List<String> OPS = List.of("组装", "装箱", "组装装箱");

    /** 是否组装/装箱类工序(含合并命名,如「组装装箱」「组装/装箱」) */
    public static boolean isAsmOp(String op) {
        String s = op == null ? "" : op.trim();
        if (s.isEmpty()) return false;
        return s.contains("组装") || s.contains("装箱");
    }

    /** 未进入时的通用拦截话术(具体行会带上末道工序名,见 {@link #notEnteredReason}) */
    public static final String REASON_NOT_ENTERED =
            "该工单行尚未进入末道工序（上一道工序还没有已审核报工流入），暂不能生成出货检验表观";

    /** 路线末道不是组装/装箱类时的话术(这类工单不出表观单,不是"还没进入") */
    public static final String REASON_NO_ASSEMBLY_OP =
            "该工单的工艺路线末道工序不是「组装/装箱」，不出出货检验表观";

    /** 带末道工序名的未进入话术(前端 {@code tt()} 用同一句原文) */
    public static String notEnteredReason(String op) {
        String o = op == null ? "" : op.trim();
        return o.isEmpty()
                ? REASON_NOT_ENTERED
                : "该工单行尚未进入末道工序「" + o + "」（上一道工序还没有已审核报工流入），暂不能生成出货检验表观";
    }

    /**
     * 判定结果。
     *
     * @param entered 是否已进入末道工序
     * @param op      末道工序名(未进入时也带上,便于前端/话术说明"差哪一道";路线不可用时为空串)
     * @param avail   该道可加工量(工序口径;>0 即前道已流入)
     * @param done    该道已审报工量(工序口径)
     * @param line    该道的实际生产线(台账实际线优先,取不到回落工单行当前线)
     * @param reason  未进入/不适用时的话术(已进入为空串)
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
        String route = str(r.get("工艺路线"));
        List<ProcessFlow.Step> flow = ProcessFlow.steps(jdbc, str(r.get("工单号")), rowId,
                num(r.get("排产数量")), route);
        Map<Long, Map<String, String>> lines = actualLines(jdbc, List.of(rowId));
        Set<String> asmShopLines = assemblyShopLines(jdbc, candidateLines(List.of(r), lines));
        return judge(flow, lastOp(jdbc, route), str(r.get("生产线")),
                lines.getOrDefault(rowId, Map.of()), asmShopLines);
    }

    /**
     * **批量判定**(「选生产工单」弹窗一页 N 行用;3 条批量查询 + 1 条末道解析 + 1 条产线车间查询)。
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
        Set<String> routes = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            Object id = r.get("行id");
            if (id instanceof Number n) ids.add(n.longValue());
            String route = str(r.get("工艺路线"));
            if (!route.isEmpty()) routes.add(route);
        }
        Map<String, String> lastOps = lastOps(jdbc, routes);
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
                    judge(flow, lastOps.get(str(r.get("工艺路线"))), str(r.get("生产线")),
                            lines.getOrDefault(n.longValue(), Map.of()), asmShopLines));
        }
        return out;
    }

    /**
     * 「工艺路线末道工序是组装/装箱类」的布尔表达式(给「选生产工单」列表做准入过滤)。
     *
     * <p>末道口径与 {@link #lastOps} 完全一致:优先取标了 {@code 是否末道工序} 的那道,
     * 没标记取 {@code 加工顺序} 最大的一道。只把「末道不是组装/装箱类」的半成品路线挡在列表外
     * —— 与 2026-11-12 一样,这类工单历史上就不出表观单。
     *
     * @param alias 外层 {@code dbo.plang} 别名(调用方固定传 {@code "p"})
     */
    public static String routeHasAssembly(String alias) {
        String p = alias == null || alias.isBlank() ? "p" : alias;
        return " AND EXISTS (SELECT 1 FROM dbo.bs_route r"
                + " WHERE r.工艺路线编码 = ISNULL(" + p + ".[工艺路线],N'')"
                + "   AND ISNULL(r.asp_cancel,'N')<>'Y'"
                + "   AND ISNULL(r.工序名称,N'')<>N''"
                + "   AND (r.工序名称 LIKE N'%组装%' OR r.工序名称 LIKE N'%装箱%')"
                + "   AND (" + LAST_FLAG + " OR (" + NO_LAST_FLAG + " AND " + IS_LAST_BY_SEQ + ")))";
    }

    /** {@code r} 这一道就是本路线的末道(标了「是否末道工序」) */
    private static final String LAST_FLAG =
            "ISNULL(r.是否末道工序,N'') IN (N'Y',N'1',N'是')";
    /** 本路线没有任何一道标了「是否末道工序」 */
    private static final String NO_LAST_FLAG =
            "NOT EXISTS (SELECT 1 FROM dbo.bs_route f WHERE f.工艺路线编码=r.工艺路线编码"
                    + " AND ISNULL(f.asp_cancel,'N')<>'Y' AND ISNULL(f.工序名称,N'')<>N''"
                    + " AND ISNULL(f.是否末道工序,N'') IN (N'Y',N'1',N'是'))";
    /** {@code r} 是本路线按加工顺序的最后一道 */
    private static final String IS_LAST_BY_SEQ =
            "NOT EXISTS (SELECT 1 FROM dbo.bs_route b WHERE b.工艺路线编码=r.工艺路线编码"
                    + " AND ISNULL(b.asp_cancel,'N')<>'Y' AND ISNULL(b.工序名称,N'')<>N''"
                    + " AND (ISNULL(b.加工顺序,999) > ISNULL(r.加工顺序,999)"
                    + "      OR (ISNULL(b.加工顺序,999) = ISNULL(r.加工顺序,999) AND b.id > r.id)))";

    public static String key(String wo, Integer xc) {
        return (wo == null ? "" : wo) + "#" + (xc == null ? 0 : xc);
    }

    // ────────────────────────────── 内部实现 ──────────────────────────────

    /**
     * 共用的判定:先解析本行末道工序,再看「量」,再看「产线」;都不成立给原因。
     *
     * @param flow         全道按量派生(顺序 = 路线加工顺序)
     * @param lastOp       路线末道工序名(可空 ⇒ 退回 flow 最后一道)
     * @param curLine      工单行当前线(plang.scx)
     * @param rowLines     **本行**的(工序 → 台账实际生产线);批量判定时必须按行切分,不能传整页
     * @param asmShopLines 属于「组装」车间的产线名集合
     */
    private static Status judge(List<ProcessFlow.Step> flow, String lastOp, String curLine,
                                Map<String, String> rowLines, Set<String> asmShopLines) {
        if (flow == null || flow.isEmpty()) return no(REASON_NO_ASSEMBLY_OP);
        String op = lastOp == null ? "" : lastOp.trim();
        ProcessFlow.Step target = op.isEmpty() ? null : stepOf(flow, op);
        // 路线末道解析不出来/明细里没有这道(数据漂移) ⇒ 退回按加工顺序的最后一道
        if (target == null) {
            target = flow.get(flow.size() - 1);
            op = target.op();
        }
        if (!isAsmOp(op)) return new Status(false, op, r4(target.avail()), r4(target.done()), "",
                REASON_NO_ASSEMBLY_OP);

        String actLine = lineOf(rowLines, op);
        boolean curLineAsm = asmShopLines.contains(curLine == null ? "" : curLine.trim());
        String line = actLine.isEmpty() ? (curLine == null ? "" : curLine.trim()) : actLine;
        // ① 前道已流入 / ② 本道已有已审报工 / ③ 本道实际线或工单当前线属组装车间 ⇒ 已进入
        if (target.availBase() > ProcessFlow.EPS || target.done() > ProcessFlow.EPS
                || asmShopLines.contains(actLine.trim()) || curLineAsm) {
            return new Status(true, op, r4(target.avail()), r4(target.done()), line, "");
        }
        return new Status(false, op, r4(target.avail()), r4(target.done()), "", notEnteredReason(op));
    }

    /** 从全道里取某道(按工序名;同名取第一道) */
    private static ProcessFlow.Step stepOf(List<ProcessFlow.Step> flow, String op) {
        for (ProcessFlow.Step s : flow) if (s.op().equals(op)) return s;
        return null;
    }

    /**
     * 本行工艺路线的**末道工序名**。
     *
     * <p>口径:优先取 {@code bs_route.是否末道工序} 标记的那道(按加工顺序取第一道);
     * 一道都没标记 ⇒ 取加工顺序最后一道。与 {@link #routeHasAssembly} 的 SQL 口径完全一致。
     */
    private static String lastOp(JdbcTemplate jdbc, String route) {
        if (route == null || route.isBlank()) return "";
        return lastOps(jdbc, Set.of(route.trim())).getOrDefault(route.trim(), "");
    }

    /** 批量解析:工艺路线编码 → 末道工序名(有「是否末道工序」标记以标记为准,否则取加工顺序最后一道) */
    private static Map<String, String> lastOps(JdbcTemplate jdbc, Set<String> routes) {
        Map<String, String> flagged = new LinkedHashMap<>();
        Map<String, String> bySeq = new LinkedHashMap<>();
        if (jdbc == null || routes == null || routes.isEmpty()) return bySeq;
        StringBuilder in = new StringBuilder();
        List<Object> args = new ArrayList<>();
        for (String route : routes) {
            if (route == null || route.isBlank()) continue;
            if (in.length() > 0) in.append(',');
            in.append('?');
            args.add(route.trim());
        }
        if (in.length() == 0) return bySeq;
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工艺路线编码 AS route, 工序名称 AS op, ISNULL(是否末道工序,N'') AS lastFlag"
                        + " FROM dbo.bs_route"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                        + "   AND 工艺路线编码 IN (" + in + ")"
                        + " ORDER BY 工艺路线编码, ISNULL(加工顺序,999), id", args.toArray())) {
            String route = str(r.get("route"));
            String op = str(r.get("op"));
            if (route.isEmpty() || op.isEmpty()) continue;
            bySeq.put(route, op);                       // 顺次覆盖 ⇒ 最终留最后一道
            if (isTrue(r.get("lastFlag"))) flagged.putIfAbsent(route, op);
        }
        bySeq.putAll(flagged);                          // 标了末道的路线以标记为准
        return bySeq;
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

    /** 批量:工单行id → (工序 → 台账实际生产线);只取组装/装箱类工序(含「组装装箱」这类合并名) */
    private static Map<Long, Map<String, String>> actualLines(JdbcTemplate jdbc, List<Long> ids) {
        Map<Long, Map<String, String>> out = new LinkedHashMap<>();
        if (jdbc == null || ids == null || ids.isEmpty()) return out;
        StringBuilder in = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) in.append(i == 0 ? "?" : ",?");
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工单行id AS pid, 工序 AS op, ISNULL(实际生产线,N'') AS line"
                        + " FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND 工单行id IN (" + in + ")"
                        + "   AND (工序 LIKE N'%组装%' OR 工序 LIKE N'%装箱%')"
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

    /** 是否标记值(Y/1/是) */
    private static boolean isTrue(Object o) {
        String s = str(o);
        return s.equalsIgnoreCase("Y") || s.equals("1") || s.equals("是");
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
