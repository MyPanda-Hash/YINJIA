package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * **工序间「按量流转」的唯一口径**(2026-11-11 用户拍板)。
 *
 * <h3>用户口径(原话)</h3>
 * <pre>
 *   「是我当前第一个工序有500个计划完成量,那么当前我就应该有200个报工完成的数量后,
 *     第二个工序就能报工对应的200来源于上一道工序完成的报工数」
 * </pre>
 * 即:工序之间按**上一道的已审完工量**往下流,不再要求前道**全量**做完才允许后道报工、
 * 才允许台账转序。方案来源:`docs/plans/2026-11-03-工单部分量转序-按量流转-方案评估.md` 方案 A。
 *
 * <h3>量(两把尺子,先折成品再比)</h3>
 * <pre>
 *   设 pl_sl = 本行排产数量(成品口径), rate(i) = bs_route.换算率(空/≤0 按 1)
 *   done(i)      该工单行该道**已审**报工量            …… 工序口径(取数见 WoInspGate.reportedQty)
 *   doneBase(i)  done(i) / rate(i)                     …… 成品口径
 *   availBase(i) i=0 ? pl_sl : doneBase(i-1)           …… 可加工量(成品口径)= 上一道流下来的
 *   avail(i)     availBase(i) × rate(i)                …… 可加工量(工序口径)= 本道能做的量
 *   planQty(i)   台账计划数量 优先,缺失回落 pl_sl × rate(i) …… 本道计划量(工序口径)
 *   wip(i)       avail(i) − done(i)                    …… 在制量(工序口径,不足 0 记 0)
 * </pre>
 * 用户例子对得上:工序1 计划 500、报 200 ⇒ {@code availBase(2) = 200} ⇒ 工序2 可报 200(报 201 被拒)。
 *
 * <h3>为什么要有这个类</h3>
 * 同一组算式此前散在 4 处(报工封顶、不跳序、转序派线、完工判定),2026-11-03 评估确认「口径 bug 会被放大」
 * (成品/工序口径错配会把"没做满"误判成"做满")。现按《代码规范》D「禁止平行实现」收口到一处,
 * 与 {@link PlangDone}/{@link PlangClose}/{@link WoInspGate} 同一个做法。
 *
 * <p>调用方:{@code WoReportService}(报工闸门)、{@code ProcessTaskService}(转序/完工/弃审)、
 * {@code WorkReportController}(报工页可加工量)。</p>
 */
public final class ProcessFlow {

    private ProcessFlow() {}

    /** 浮点容差(数量比较统一用这个) */
    public static final double EPS = 0.0001;

    /** 超产容差:可报上限 = 可加工量 × 1.01(沿用 2026 以来的 1% 现场容差) */
    public static final double OVER = 1.01;

    /**
     * 路线缺失时的兜底工序顺序 —— 与 {@code ProcessTaskService.PROCESS_ORDER} 同一个值。
     * ⚠ 两处必须同值(那边是 private 常量),改工序口径时一起改。
     */
    private static final String[] DEFAULT_OPS = {"混料", "成型", "切炭", "组装", "装箱"};

    /**
     * 一道工序的按量派生结果。
     *
     * @param op        工序名(与 {@code scjl.gxdm}/{@code bs_route.工序名称} 同一份字典值)
     * @param rate      换算率(空/≤0 已归一为 1)
     * @param planQty   本道计划量(工序口径;台账优先,缺失=pl_sl×rate)
     * @param done      本道已审报工量(工序口径)
     * @param doneBase  已审报工折成品 = done / rate
     * @param availBase 可加工量折成品 = 上一道 doneBase(首道 = pl_sl)
     * @param avail     可加工量(工序口径) = availBase × rate
     * @param wip       在制量(工序口径) = avail − done,不足 0 记 0
     */
    public record Step(String op, double rate, double planQty, double done,
                       double doneBase, double availBase, double avail, double wip) {

        /** 本道**折成品**是否已做满:doneBase ≥ pl_sl(生产完工判据) */
        public boolean full(double plSl) {
            return plSl > EPS && doneBase + EPS >= plSl;
        }

        /** 本道有没有流入量(前道已经流下来 ⇒ 可以开工/可以报工) */
        public boolean flowing() {
            return availBase > EPS;
        }

        /**
         * 台账状态(按量,幂等 set 语义):
         * {@code 计划} 无流入 / {@code 已落实} 有流入未做满 / {@code 已完工} 折成品做满。
         */
        public String state(double plSl) {
            if (!flowing()) return "计划";
            return full(plSl) ? "已完工" : "已落实";
        }

        /**
         * 本道**可报上限**(工序口径,含 1% 超产容差)。
         *
         * <p>首道:可加工量 = pl_sl × rate = 计划量 ⇒ 与历史口径完全一致(计划量 × 1.01);
         * 后道:可加工量 = 上一道已审折成品 × 本道换算率 ⇒ 只能报到"前道真正流下来的量"。
         * 无流入(≤0)时按计划量兜底 —— 此时由「不跳序」校验先给出可读提示,不会走到数量校验。
         */
        public double reportCap() {
            double base = avail > EPS ? Math.min(planQty > EPS ? planQty : Double.MAX_VALUE, avail) : planQty;
            return base > 0 ? base * OVER : 0;
        }
    }

    /**
     * 该工单行**全道**按量派生(顺序 = 工艺路线加工顺序)。
     *
     * @param plNo  工单号
     * @param rowId 工单行 id({@code plang.id});null/0 时退化为整单口径(兼容历史调用)
     * @param plSl  本行排产数量(成品口径)
     * @param route 本行工艺路线编码(可空 ⇒ 兜底 {@link #DEFAULT_OPS})
     */
    public static List<Step> steps(JdbcTemplate jdbc, String plNo, Long rowId, double plSl, String route) {
        if (plNo == null || plNo.isBlank()) return new ArrayList<>();
        // 数据侧只做"取数",算式统一走下面的纯计算重载(两处不可能出现两套公式)
        List<Map<String, Object>> rls = routeLines(jdbc, route);
        Map<String, Double> done = new LinkedHashMap<>();
        for (Map<String, Object> line : rls) {
            String op = str(line.get("工序名称"));
            if (!op.isEmpty()) done.put(op, WoInspGate.reportedQty(jdbc, plNo.trim(), rowId, op));
        }
        return steps(rls, plSl, ledgerPlanQty(jdbc, plNo.trim(), rowId), done);
    }

    /**
     * **纯计算版**(不查库) —— 给"一次要算几百行"的列表/看板用:数据由调用方**批量预取**后传进来。
     *
     * <p>与 {@link #steps(JdbcTemplate, String, Long, double, String)} 共用同一套算式;
     * 唯一的区别是数据来源(逐行查库 vs 批量预取),口径不会分化。
     *
     * @param routeLines 路线明细(键:{@code 工序名称}/{@code 换算率};空 ⇒ 返回空表,由调用方兜底)
     * @param plSl       本行排产数量(成品口径)
     * @param ledgerPlan 台账计划量(键=工序名;缺 ⇒ 回落 plSl × rate)
     * @param doneByOp   各道**已审**报工量(键=工序名;缺 ⇒ 0)
     */
    public static List<Step> steps(List<Map<String, Object>> routeLines, double plSl,
                                   Map<String, Double> ledgerPlan, Map<String, Double> doneByOp) {
        List<Step> out = new ArrayList<>();
        if (routeLines == null || routeLines.isEmpty()) return out;
        double prevDoneBase = 0;
        boolean first = true;
        for (Map<String, Object> line : routeLines) {
            String op = str(line.get("工序名称"));
            if (op.isEmpty()) continue;
            double rate = num(line.get("换算率"));
            if (rate <= 0) rate = 1;
            double done = doneByOp == null ? 0 : doneByOp.getOrDefault(op, 0d);
            double doneBase = done / rate;
            double availBase = first ? plSl : prevDoneBase;
            double avail = availBase * rate;
            double planQty = ledgerPlan == null ? 0 : ledgerPlan.getOrDefault(op, 0d);
            if (planQty <= 0) planQty = plSl * rate;
            out.add(new Step(op, rate, planQty, done, doneBase, availBase, avail, Math.max(avail - done, 0)));
            prevDoneBase = doneBase;
            first = false;
        }
        return out;
    }

    /**
     * **批量给「工单行」列表补 4 个只读展示字段**(2026-11-12 用户口径:方案 A = 只做显示):
     * <pre>
     *   上道完工折成品  = 首道 ? 排产数量 : 上道已审报工 ÷ 上道换算率     (成品口径)
     *   当前工序可加工量 = 上道完工折成品 × 本工序换算率                  (工序口径)
     *   当前工序待报量   = max(可加工量 − 本工序已审报工, 0)
     *   当前工序待流入量 = max(本工序计划量 − 可加工量, 0)
     * </pre>
     *
     * <p>⚠ **只读**:这里只往行 Map 里 put 展示字段,不写任何库、不改报工校验/转序判据。
     * 取数只做 3 条批量查询(台账计划量 / 已审报工 / 路线换算率),与行数无关
     * —— 列表页一次返回 400+ 行,逐行查库会秒级卡顿(实测教训)。
     *
     * <p>入参行需带:{@code 行id}(plang.id)、{@code 排产数量}、{@code 当前工序}、{@code 工艺路线}。
     */
    public static void enrichRowFlow(JdbcTemplate jdbc, List<Map<String, Object>> rows) {
        if (jdbc == null || rows == null || rows.isEmpty()) return;
        List<Long> ids = new ArrayList<>();
        Set<String> routes = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            Object id = r.get("行id");
            if (id instanceof Number n) ids.add(n.longValue());
            String route = str(r.get("工艺路线"));
            if (!route.isEmpty()) routes.add(route);
            r.put("上道完工折成品", 0d);
            r.put("当前工序可加工量", 0d);
            r.put("当前工序待报量", 0d);
            r.put("当前工序待流入量", 0d);
        }
        if (ids.isEmpty() || routes.isEmpty()) return;
        Map<Long, Map<String, Double>> ledger = batchLedgerPlan(jdbc, ids);
        Map<Long, Map<String, Double>> done = batchDone(jdbc, ids);
        Map<String, List<Map<String, Object>>> routeCache = new LinkedHashMap<>();
        for (Map<String, Object> rl : jdbc.queryForList(
                "SELECT 工艺路线编码, 工序名称, ISNULL(换算率,1) AS 换算率 FROM dbo.bs_route"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(工序名称,N'')<>N''"
                        + "   AND 工艺路线编码 IN (" + placeholders(routes.size()) + ")"
                        + " ORDER BY ISNULL(加工顺序,999), id", routes.toArray())) {
            routeCache.computeIfAbsent(str(rl.get("工艺路线编码")), k -> new ArrayList<>()).add(rl);
        }
        for (Map<String, Object> r : rows) {
            Object idObj = r.get("行id");
            if (!(idObj instanceof Number n)) continue;
            long pid = n.longValue();
            List<Map<String, Object>> rls = routeCache.get(str(r.get("工艺路线")));
            if (rls == null || rls.isEmpty()) continue;
            double plSl = num(r.get("排产数量"));
            List<Step> flow = steps(rls, plSl, ledger.get(pid), done.get(pid));
            String curOp = str(r.get("当前工序"));
            if (curOp.isEmpty()) curOp = currentOp(flow, plSl);
            Step cur = stepOf(flow, curOp);
            if (cur == null) continue;
            r.put("上道完工折成品", round4(cur.availBase()));
            r.put("当前工序可加工量", round4(cur.avail()));
            r.put("当前工序待报量", round4(Math.max(cur.avail() - cur.done(), 0)));
            r.put("当前工序待流入量", round4(Math.max(cur.planQty() - cur.avail(), 0)));
            // 全道明细(2026-11-12):一行只能显示"当前工序",后道(如装箱 1000/待流入4000)在单值列里看不到
            //   ⇒ 每行带一份**逐道**明细,前端用「展开行」渲染。纯内存计算(数据已批量取好),不查库。
            List<Map<String, Object>> detail = new ArrayList<>();
            for (Step st : flow) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("工序", st.op());
                d.put("换算率", round4(st.rate()));
                d.put("计划量", round4(st.planQty()));
                d.put("上道完工折成品", round4(st.availBase()));
                d.put("可加工量", round4(st.avail()));
                d.put("已审完工", round4(st.done()));
                d.put("待报量", round4(Math.max(st.avail() - st.done(), 0)));
                d.put("待流入量", round4(Math.max(st.planQty() - st.avail(), 0)));
                d.put("状态", st.state(plSl));
                d.put("当前", st.op().equals(curOp));
                detail.add(d);
            }
            r.put("工序流转明细", detail);
        }
    }

    /** 批量:台账计划量(键 = 工单行id → 工序 → 计划数量;同名工序取第一条) */
    private static Map<Long, Map<String, Double>> batchLedgerPlan(JdbcTemplate jdbc, List<Long> ids) {
        Map<Long, Map<String, Double>> out = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工单行id AS pid, 工序, ISNULL(计划数量,0) AS 计划数量 FROM dbo.wo_process_line"
                        + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 工单行id IN (" + placeholders(ids.size()) + ")"
                        + " ORDER BY ISNULL(工序序,999), id", ids.toArray())) {
            Object pid = r.get("pid");
            if (!(pid instanceof Number n)) continue;
            out.computeIfAbsent(n.longValue(), k -> new LinkedHashMap<>())
                    .putIfAbsent(str(r.get("工序")), num(r.get("计划数量")));
        }
        return out;
    }

    /** 批量:各工单行各道**已审**报工量(锚 scjl.gd_id → plang_pc.plang_id,老数据按批次兜底 —— 与列表口径同源) */
    private static Map<Long, Map<String, Double>> batchDone(JdbcTemplate jdbc, List<Long> ids) {
        Map<Long, Map<String, Double>> out = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT p.id AS pid, ISNULL(s.gxdm,N'') AS op, SUM(ISNULL(s.sl,0)) AS qty"
                        + " FROM dbo.plang p JOIN dbo.scjl s ON s.gldh = p.pl_no"
                        + "   AND ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = p.id)"
                        + "        OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=ISNULL(p.[批次号],N'')))"
                        + " WHERE p.id IN (" + placeholders(ids.size()) + ")"
                        + " GROUP BY p.id, s.gxdm", ids.toArray())) {
            Object pid = r.get("pid");
            if (!(pid instanceof Number n)) continue;
            String op = str(r.get("op"));
            if (op.isEmpty()) continue;
            out.computeIfAbsent(n.longValue(), k -> new LinkedHashMap<>()).put(op, num(r.get("qty")));
        }
        return out;
    }

    private static String placeholders(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) { if (i > 0) sb.append(','); sb.append('?'); }
        return sb.toString();
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    /** 取某道工序的按量结果;工序不在路线上 ⇒ null */
    public static Step stepOf(List<Step> steps, String op) {
        if (steps == null || op == null) return null;
        String want = op.trim();
        for (Step s : steps) if (s.op().equals(want)) return s;
        return null;
    }

    /** 工序在本行路线里的序号(0 基);不在路线上 ⇒ -1 */
    public static int indexOf(List<Step> steps, String op) {
        if (steps == null || op == null) return -1;
        String want = op.trim();
        for (int i = 0; i < steps.size(); i++) if (steps.get(i).op().equals(want)) return i;
        return -1;
    }

    /**
     * 本行**当前工序(兼容单值)** = 第一道「已落实」的工序(= 最前未完工道);全做完 ⇒ 末道。
     *
     * <p>按量流转后可能**多道同时在制**(成型在做、切炭也在做已流入的那批),但调拨/日计划/打印/
     * 负荷仍需要单值 ⇒ 取"最前面还没做完的那道",与看板/列表的「当前工序」同口径。
     *
     * @return 工序名;路线为空 ⇒ null
     */
    public static String currentOp(List<Step> steps, double plSl) {
        if (steps == null || steps.isEmpty()) return null;
        for (Step s : steps) if ("已落实".equals(s.state(plSl))) return s.op();
        return steps.get(steps.size() - 1).op();       // 各道都没在制(全完成 / 全无流入)
    }

    /**
     * **弃审/作废前置守卫**:按弃审后的口径算一遍,若后道已审报工量超过新可加工量(负在制)⇒ 抛出。
     *
     * <p>为什么必须有:按量流转后,前道弃审会把可加工量收回去;下游如果已经把那些量做掉了,
     * 账就出现「做出来的比流下来的多」。此时必须挡住弃审,让现场先处理下游报工。
     *
     * @param steps 已按"弃审后"数据算好的 {@link #steps}
     * @throws IllegalStateException 负在制(消息直接可读,带工单/工序/数量)
     */
    public static void assertNoNegativeWip(List<Step> steps, double plSl, String plNo) {
        if (steps == null) return;
        for (Step s : steps) {
            if (s.done() > s.avail() + EPS && s.done() > EPS) {
                throw new IllegalStateException("不能弃审/作废:工单 " + plNo + " 的「" + s.op()
                        + "」已审报工 " + trim(s.done()) + " 超过上道流下来的可加工量 " + trim(s.avail())
                        + ",请先弃审/作废该道报工");
            }
        }
    }

    /** 本行路线:工序名称 + 换算率(空路线 → {@link #DEFAULT_OPS},换算率一律 1) */
    private static List<Map<String, Object>> routeLines(JdbcTemplate jdbc, String route) {
        List<Map<String, Object>> lines = new ArrayList<>();
        String r = route == null ? "" : route.trim();
        if (!r.isEmpty()) {
            lines.addAll(jdbc.queryForList(
                    "SELECT 工序名称, ISNULL(换算率,1) AS 换算率 FROM dbo.bs_route"
                            + " WHERE 工艺路线编码=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + "   AND ISNULL(工序名称,N'')<>N''"
                            + " ORDER BY ISNULL(加工顺序,999), id", r));
        }
        if (lines.isEmpty()) {
            for (String op : DEFAULT_OPS) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("工序名称", op);
                m.put("换算率", 1);
                lines.add(m);
            }
        }
        return lines;
    }

    /** 台账计划数量(按行锚定,同名工序取第一条);没有台账 ⇒ 空(调用方回落 pl_sl × rate) */
    private static Map<String, Double> ledgerPlanQty(JdbcTemplate jdbc, String plNo, Long rowId) {
        Map<String, Double> out = new LinkedHashMap<>();
        if (rowId == null || rowId <= 0) return out;
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工序, ISNULL(计划数量,0) AS 计划数量 FROM dbo.wo_process_line"
                        + " WHERE 工单号=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + "   AND (工单行id=? OR 工单行id IS NULL)"
                        + " ORDER BY ISNULL(工序序,999), id", plNo, rowId)) {
            String op = str(r.get("工序"));
            if (!op.isEmpty()) out.putIfAbsent(op, num(r.get("计划数量")));
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private static String trim(double v) {
        if (Math.abs(v - Math.rint(v)) < 0.00005) return String.valueOf((long) Math.rint(v));
        return java.math.BigDecimal.valueOf(v).stripTrailingZeros().toPlainString();
    }
}
