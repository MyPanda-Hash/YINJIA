package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        List<Step> out = new ArrayList<>();
        if (plNo == null || plNo.isBlank()) return out;
        Map<String, Double> ledgerPlan = ledgerPlanQty(jdbc, plNo.trim(), rowId);
        double prevDoneBase = 0;
        boolean first = true;
        for (Map<String, Object> line : routeLines(jdbc, route)) {
            String op = str(line.get("工序名称"));
            double rate = num(line.get("换算率"));
            if (rate <= 0) rate = 1;
            double done = WoInspGate.reportedQty(jdbc, plNo.trim(), rowId, op);
            double doneBase = done / rate;
            double availBase = first ? plSl : prevDoneBase;
            double avail = availBase * rate;
            double planQty = ledgerPlan.getOrDefault(op, 0d);
            if (planQty <= 0) planQty = plSl * rate;
            out.add(new Step(op, rate, planQty, done, doneBase, availBase, avail, Math.max(avail - done, 0)));
            prevDoneBase = doneBase;
            first = false;
        }
        return out;
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
