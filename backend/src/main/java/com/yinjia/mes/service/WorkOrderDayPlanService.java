package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * 工单日排产(生产工单 / 工单排产 两页表格内的「日期列」,2026-10-29)。
 *
 * <p><b>用户口径</b>(2026-10-29,附《成型车间排单计划》纸表 + 生产工单页截图):
 * 「生产工单中需要能实现对后面日期的排产量设定,或者根据设定完工日期和数量配置每天需要完成的数量……
 * 在当前的表格内容处插入当前设定的日排产数量,修改需要针对当前生产工单和工单排产中都要实现」。
 * ⇒ **页面不新增任何表格/块**:两张现有明细表各追加日期列;本服务只负责:
 * <ol>
 *   <li><b>读</b>:窗口内每行的「日计划」与「日报工」(scjl 已审核,含手机端吸收);已报工量
 *       作为格下方小字对照;</li>
 *   <li><b>算</b>(2026-10-31 起):「日计划」不再是人工填的账,而是 {@link DayPlanSpread} 按
 *       「工序计划量 ÷ 开工日→交期」**自动均摊**出来的派生值 —— 用户口径
 *       「**当前不需要手填,能自动算就可以了**」;</li>
 *   <li><b>写</b>:{@link #save} 保留(兼容/回滚用),页面已不再调用。</li>
 * </ol>
 *
 * <p><b>口径</b>:
 * <ul>
 *   <li>行键 = {@code plang.id};</li>
 *   <li>工序:生产工单页 = 该行 {@code plang.[当前工序]}(空则回落台账当前道);工单排产页 = 所选产线车间的工序;</li>
 *   <li>报工锚 {@code scjl.gd_id → plang_pc.plang_id},老数据 {@code gd_id=0} 按(工单号+批次号)
 *       唯一命中兜底;只认 {@code wgzt='Y'}(草稿/待审核不算完成);</li>
 *   <li>两账不合一:计划是派生值(算出来的),完成量永远是报工事实,互不覆盖。</li>
 * </ul>
 */
@Service
public class WorkOrderDayPlanService {

    /** 日期列上限(按数据生成后最多保留这么多列,取最近的一段) */
    private static final int MAX_COLUMNS = 160;
    /** 单段计划区间最多铺多少天(防脏数据把列撑爆) */
    private static final int RANGE_CAP_DAYS = 120;
    /** 单次保存格子数上限 */
    private static final int MAX_SAVE_CELLS = 5000;

    private final JdbcTemplate jdbc;
    private final ScheduleBoardService board;

    public WorkOrderDayPlanService(JdbcTemplate jdbc, ScheduleBoardService board) {
        this.jdbc = jdbc;
        this.board = board;
    }

    /**
     * 读:窗口内每行的日计划 / 日报工。
     *
     * @param ids        生产工单页:当前表格里的行 id(空 = 走产线模式)
     * @param line       工单排产页:选中产线
     * @param scope      未完工/已完工/全部(产线模式,与排产明细页签同口径)
     * @param futureDays 未来最少列数(默认 14);实际窗口会按各行「计划完工日期」自动延长到最晚那天
     *                   (用户口径「28 号往后的表格显示不全」⇒ 不再按固定天数截断)
     * @param workshop   登录账号车间(可空)
     */
    public Map<String, Object> data(List<Long> ids, String line, String scope, Integer futureDays, String workshop) {
        LocalDate today = LocalDate.now();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("今天", today.toString());

        List<RowRef> refs = resolveRows(ids, line, scope, workshop);
        if (refs.isEmpty()) {
            out.put("日期", List.of());
            out.put("行", List.of());
            return out;
        }
        List<Long> rowIds = new ArrayList<>();
        for (RowRef r : refs) rowIds.add(r.id);

        // 日计划(2026-10-31):默认由「工序计划量 ÷ 开工日→交期」自动均摊({@link DayPlanSpread});
        //   **双击改过的那天**存 wo_day_plan 当「人工指定」,其余天按剩余量重摊(守恒,用户口径
        //   「剩余量重摊,总数守恒」)。一行一份 {日期:数量};下面的「计划合计 / 7天已排 / 15天已排」
        //   全部用同一份,保证格子与行汇总永远是同一把尺。
        Map<String, Double> opCaps = new LinkedHashMap<>();
        for (RowRef r : refs) opCaps.put(rowKey(r.id, r.op), round(r.planQty * rateOf(jdbc, r.route(), r.op())));
        Map<String, Map<LocalDate, Double>> manual = manualByDate(rowIds);
        Map<String, Map<String, Double>> plans = mergedPlans(refs, opCaps, manual, today);
        Map<String, Map<String, Double>> actuals = actualByDate(rowIds);
        // 日期列**按数据生成**(2026-10-29 用户口径「不存在当前日期的时候不显示这些数据列」):
        //   = 这些行的自动日计划/日报工出现过的日期 ∪ 各工序「计划开工~计划完工」区间;
        //   不再给「今天-14 ~ 今天+14」的固定窗口(那样会满屏空列)。
        List<String> dates = buildDates(refs, plans, actuals, today);
        out.put("日期", dates);
        // 产能可见(2026-10-31 用户口径「产能只显示、不拦截」):
        //   · 产线产能 = bs_prod_line.日产能(0/空 = 未配 ⇒ 不判超载,沿用列注明「0=不判超载」);
        //   · 每日已排 = 该线**全部在册行**(plang.scx,不分页签)的自动日计划按日合计;
        //   只对「工单排产页」(按产线)出这两项;生产工单页(按行 id)返回结构不变(前端不用即忽略)。
        boolean lineMode = (ids == null || ids.isEmpty()) && !str(line).isEmpty();
        out.put("产线产能", lineMode ? dayCapacity(str(line)) : 0d);
        out.put("每日已排", lineMode ? lineDailyPlan(str(line), dates, today) : Map.of());
        LocalDate d7 = today.plusDays(7);
        LocalDate d15 = today.plusDays(15);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (RowRef r : refs) {
            String key = rowKey(r.id, r.op);
            Map<String, Double> planAll = plans.getOrDefault(key, Map.of());
            Map<String, Double> doneAll = actuals.getOrDefault(key, Map.of());
            double plannedTotal = 0;
            for (double v : planAll.values()) plannedTotal += v;
            double doneTotal = 0;
            for (double v : doneAll.values()) doneTotal += v;

            // 需交付三桶:按交期落桶(逾期归 7 天;无交期归 大于15天)
            double due7 = 0, due15 = 0, dueOver = 0;
            if (r.due == null) {
                dueOver = r.demand;
            } else {
                long left = java.time.temporal.ChronoUnit.DAYS.between(today, r.due);
                if (left <= 7) due7 = r.demand;
                else if (left <= 15) due15 = r.demand;
                else dueOver = r.demand;
            }
            // 已排三桶:7天/15天为**累计**(≤7 / ≤15,与纸表「7天=15天」同口径),大于15天为 15 天之后的部分
            double plan7 = 0, plan15 = 0, planOver = 0;
            for (Map.Entry<String, Double> p : planAll.entrySet()) {
                LocalDate d = parseDate(p.getKey());
                if (d == null) continue;
                if (!d.isAfter(d7)) plan7 += p.getValue();
                if (!d.isAfter(d15)) plan15 += p.getValue();
                else planOver += p.getValue();
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("行id", r.id);
            row.put("工序", r.op);
            row.put("交期", r.due == null ? "" : r.due.toString());
            row.put("交期紧迫度", r.due == null ? null
                    : java.time.temporal.ChronoUnit.DAYS.between(today, r.due));
            row.put("需求数量", r.demand);
            row.put("排产数量", r.planQty);
            // 工序计划量 = 排产数量 × 该道换算率(与保存守卫、工序进度同一公式;取不到工艺路线/工序按率 1)。
            //   2026-10-31:它是「自动日计划」的**总额**,日计划已由系统摊好 ⇒ 未分配量恒为 0(前端列已撤)。
            row.put("工序计划量", opCaps.getOrDefault(key, 0d));
            row.put("7天需交付", due7);
            row.put("15天需交付", due15);
            row.put("大于15天需交付", dueOver);
            row.put("7天已排", plan7);
            row.put("15天已排", plan15);
            row.put("大于15天已排", planOver);
            row.put("日计划", slice(planAll, dates));
            row.put("日报工", slice(doneAll, dates));
            row.put("计划合计", plannedTotal);
            row.put("完工合计", doneTotal);
            // 人工指定 + 超分配(2026-10-31):前端拿它画「手」角标、清空即恢复自动;超分配只提示不拦。
            Map<LocalDate, Double> m = manual.getOrDefault(key, Map.of());
            Map<String, Double> manualOut = new LinkedHashMap<>();
            for (LocalDate d : new java.util.TreeSet<>(m.keySet())) {
                if (m.get(d) != null) manualOut.put(d.toString(), m.get(d));
            }
            row.put("人工指定", manualOut);
            row.put("超分配", DayPlanSpread.overAllocated(opCaps.getOrDefault(key, 0d), m));
            row.put("计划开工日期", r.start == null ? "" : r.start.toString());
            rows.add(row);
        }
        out.put("行", rows);
        return out;
    }

    /**
     * **成型车间排单计划**(2026-10-31 用户口径:「需要能打出这样的报表形式,就在当前工单排产处实现即可,
     * 这样就不需要根据那个产线进行处理了」)。
     *
     * <p>= **全部在册排产行**(`board.scheduled("")` —— 不分产线) + 每行的日计划
     * (与页面上格子同一把尺:人工指定 ∪ 自动摊剩余)。只读、不落表,供前端按纸表版式打印。
     *
     * @param scope    未完工/已完工/全部(与页面页签同口径)
     * @param workshop 登录账号车间(空 = 全部)
     */
    public Map<String, Object> planSheet(String scope, String workshop) {
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> rows = board.scheduled("", scope, workshop);
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> r : rows) if (r.get("行id") instanceof Number n) ids.add(n.longValue());
        if (ids.isEmpty()) {
            out.put("日期", List.of());
            out.put("今天", LocalDate.now().toString());
            out.put("行", List.of());
            return out;
        }
        Map<String, Object> day = data(ids, null, scope, null, workshop);
        out.put("日期", day.getOrDefault("日期", List.of()));
        out.put("今天", day.getOrDefault("今天", LocalDate.now().toString()));
        // 行id → 日计划/汇总(与页面同一份算法)
        Map<Long, Map<String, Object>> byId = new HashMap<>();
        Object list = day.get("行");
        if (list instanceof List<?> l) {
            for (Object o : l) {
                if (o instanceof Map<?, ?> m && m.get("行id") instanceof Number n) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> mm = (Map<String, Object>) m;
                    byId.put(n.longValue(), mm);
                }
            }
        }
        for (Map<String, Object> r : rows) {
            if (!(r.get("行id") instanceof Number n)) continue;
            Map<String, Object> d = byId.get(n.longValue());
            if (d == null) continue;
            for (String k : new String[]{"交期", "交期紧迫度", "7天已排", "15天已排", "大于15天已排",
                    "日计划", "人工指定", "超分配", "计划合计", "工序计划量", "工序"}) {
                if (d.containsKey(k)) r.put(k, d.get(k));
            }
        }
        out.put("行", rows);
        return out;
    }

    /**
     * 写:保存日计划格子。计划数量 &gt; 0 = 写入/覆盖;0 或空 = 软删该格(留痕不物理删)。
     *
     * @param cells { 工单行id, 工序, 生产线, 计划日期, 计划数量 }
     * @param user  当前登录账号
     */
    @Transactional
    public Map<String, Object> save(List<Map<String, Object>> cells, String user) {
        if (cells == null || cells.isEmpty()) return Map.of("保存格数", 0, "清空格数", 0);
        if (cells.size() > MAX_SAVE_CELLS) throw new IllegalArgumentException("一次保存的格子过多(" + cells.size() + ")");

        int saved = 0, cleared = 0;
        // 本次动过的 (工单行id|工序) —— 保存完逐个做「Σ计划 ≤ 排产数量」的守卫(2026-10-30)
        Map<String, double[]> touched = new LinkedHashMap<>();
        for (Map<String, Object> cell : cells) {
            long rowId = longOf(cell.get("工单行id"));
            if (rowId <= 0) throw new IllegalArgumentException("缺少工单行id");
            String op = str(cell.get("工序"));                 // 未排产行允许空工序(计划先行)
            String dateText = str(cell.get("计划日期"));
            LocalDate date;
            try {
                date = LocalDate.parse(dateText);
            } catch (RuntimeException ex) {
                throw new IllegalArgumentException("日期格式应为 yyyy-MM-dd:" + dateText);
            }
            double qty = num(cell.get("计划数量"));
            String line = str(cell.get("生产线"));

            Map<String, Object> wo = woRow(rowId);
            if (wo == null) throw new IllegalArgumentException("工单行不存在或已作废:" + rowId);
            String no = str(wo.get("pl_no"));
            Integer xc = wo.get("pl_xc") instanceof Number n ? n.intValue() : null;
            touched.put(rowId + "|" + (op == null ? "" : op), new double[]{0});

            if (qty <= 0) {
                cleared += jdbc.update(
                        "UPDATE dbo.wo_day_plan SET 计划数量=0, asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                                + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N'",
                        user, rowId, op, date);
                continue;
            }
            int n = jdbc.update(
                    "UPDATE dbo.wo_day_plan SET 计划数量=?, 生产线=?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N'",
                    qty, line, user, rowId, op, date);
            if (n == 0) {
                jdbc.update(
                        "INSERT INTO dbo.wo_day_plan (工单行id, 工单号, 工单行号, 工序, 计划日期, 计划数量, 生产线,"
                                + " asp_user1, asp_time1, asp_cancel)"
                                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME(), 'N')",
                        rowId, no, xc, op, date, qty, line, user);
            }
            saved++;
        }
        // 2026-10-31 下午:原 2026-10-30 的「Σ计划 ≤ 排产数量 × 换算率，超了整笔回滚」是**全量手填**时代的闸；
        //   现在 wo_day_plan 只存「人工指定」,人工改大一点(临时插单/赶工)不该 500 ⇒ 改成**软校验**:
        //   超了记进返回值「超分配」清单,自动部分不再摊(R = 0),但照样保存 —— 沿用用户口径「不堵死录入」。
        List<Map<String, Object>> over = new ArrayList<>();
        for (Map.Entry<String, double[]> e : touched.entrySet()) {
            String[] k = e.getKey().split("\\|", 2);
            long rid = longOf(k[0]);
            String op = k[1];
            Double planSl = jdbc.queryForObject(
                    "SELECT ISNULL(pl_sl,0) FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", Double.class, rid);
            if (planSl == null) continue;
            String route = jdbc.queryForObject(
                    "SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.plang WHERE id=?", String.class, rid);
            double rate = rateOf(jdbc, route, op);
            double sum = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(计划数量),0) FROM dbo.wo_day_plan WHERE 工单行id=? AND 工序=? AND asp_cancel='N'",
                    Double.class, rid, op);
            double cap = round(planSl * rate);
            if (sum > cap + 0.0001) {
                Map<String, Object> w = new LinkedHashMap<>();
                w.put("工单行id", rid);
                w.put("工序", op == null ? "" : op);
                w.put("人工合计", round(sum));
                w.put("工序计划量", cap);
                w.put("超出", round(sum - cap));
                over.add(w);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("保存格数", saved);
        out.put("清空格数", cleared);
        out.put("超分配", over);
        return out;
    }

    /**
     * **切单拆日排产**(2026-10-30):把父行该切出量对应的日计划,按日期从**最晚往回扣**,同日同工序移给子单。
     *
     * <p>🔴 为什么要做:切单只改 plang.pl_sl,wo_day_plan 不动 ⇒ 父行「计划合计」仍等于切单前的量
     * (> 新排产数量),子行「计划合计」= 0 却有排产数量 —— 生产工单/工单排产两页的日期列与汇总列直接失真。
     *
     * <p>口径:
     * <ul>
     *   <li>日计划按**工序**存,单位是该道工序单位;切出量是**成品单位** ⇒ 每道扣 {@code 切出量 × 该道换算率};</li>
     *   <li>从**最晚的计划日**往回扣(现场先把后面的活切走,前面的照旧做),扣多少给子单同日同工序多少;</li>
     *   <li>某道计划合计不足扣减时,扣完为止,不足部分在返回值里报出来(不虚增子单计划);</li>
     *   <li>守恒:父行扣掉的 = 子行新增的(逐格相等)。</li>
     * </ul>
     *
     * @return { 已拆数量(成品单位), 已拆格数, 未拆数量(父行该道计划不足的部分) }
     */
    @Transactional
    public Map<String, Object> splitFrom(long parentId, long childId, String childNo, Integer childXc,
                                        double qty, String route, String line, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("已拆数量", 0.0);
        out.put("已拆格数", 0);
        out.put("未拆数量", 0.0);
        if (parentId <= 0 || childId <= 0 || !(qty > 0)) return out;
        List<Map<String, Object>> cells = jdbc.queryForList(
                "SELECT 工序, 计划日期, SUM(计划数量) AS qty, MAX(ISNULL(生产线,N'')) AS line"
                        + " FROM dbo.wo_day_plan WHERE 工单行id=? AND asp_cancel='N'"
                        + " GROUP BY 工序, 计划日期 ORDER BY 工序, 计划日期 DESC", parentId);
        if (cells.isEmpty()) return out;

        double movedTotal = 0;      // 成品口径(按已扣工序单位折算回去后累加)
        double shortTotal = 0;      // 成品口径
        int movedCells = 0;
        Map<String, Double> remainingByOp = new LinkedHashMap<>();
        for (Map<String, Object> c : cells) {
            String op = str(c.get("工序"));
            if (op == null) op = "";
            double rate = rateOf(jdbc, route, op);
            double need = remainingByOp.computeIfAbsent(op, k -> round(qty * rate));   // 该道还要扣多少(工序单位)
            if (need <= 0.0001) continue;
            double cellQty = num(c.get("qty"));
            if (cellQty <= 0.0001) continue;
            Object dateObj = c.get("计划日期");
            if (dateObj == null) continue;
            double take = Math.min(cellQty, need);
            take = round(take);
            if (take <= 0.0001) continue;
            // 父行扣减
            jdbc.update("UPDATE dbo.wo_day_plan SET 计划数量 = 计划数量 - ?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N'",
                    take, user, parentId, op, dateObj);
            // 扣到 0 的格子作废(与 save() 的清空语义一致,保留行但不再占唯一键之外的东西)
            jdbc.update("UPDATE dbo.wo_day_plan SET 计划数量=0, asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N' AND 计划数量<=0.0001",
                    user, parentId, op, dateObj);
            // 子行同日期同工序新增(已有则累加)
            int n = jdbc.update("UPDATE dbo.wo_day_plan SET 计划数量 = 计划数量 + ?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N'",
                    take, user, childId, op, dateObj);
            if (n == 0) {
                jdbc.update("INSERT INTO dbo.wo_day_plan (工单行id, 工单号, 工单行号, 工序, 计划日期, 计划数量, 生产线,"
                                + " asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                        childId, childNo, childXc, op, dateObj, take,
                        str(c.get("line")) == null || str(c.get("line")).isBlank() ? line : str(c.get("line")), user);
            }
            remainingByOp.put(op, round(need - take));
            movedTotal += take / rate;
            movedCells++;
        }
        for (Map.Entry<String, Double> e : remainingByOp.entrySet()) {
            if (e.getValue() > 0.0001) shortTotal += e.getValue() / rateOf(jdbc, route, e.getKey());
        }
        out.put("已拆数量", round(movedTotal));
        out.put("已拆格数", movedCells);
        out.put("未拆数量", round(shortTotal));
        return out;
    }

    /**
     * **撤回切单:把子单的日计划并回父行**(2026-10-30,与 {@link #splitFrom} 严格互逆)。
     *
     * <p>同日同工序累加到父行;子单那些格子随后软删 —— 否则子单被软删后,它的日计划成了孤儿活跃行
     * (读不到、也永不释放),而父行计划永远少一块。
     *
     * @return 并回的格数
     */
    @Transactional
    public int mergeFrom(long childId, long parentId, String parentNo, Integer parentXc, String user) {
        if (childId <= 0 || parentId <= 0) return 0;
        List<Map<String, Object>> cells = jdbc.queryForList(
                "SELECT 工序, 计划日期, SUM(计划数量) AS qty, MAX(ISNULL(生产线,N'')) AS line"
                        + " FROM dbo.wo_day_plan WHERE 工单行id=? AND asp_cancel='N'"
                        + " GROUP BY 工序, 计划日期 ORDER BY 工序, 计划日期", childId);
        int merged = 0;
        for (Map<String, Object> c : cells) {
            String op = str(c.get("工序"));
            Object dateObj = c.get("计划日期");
            double qty = num(c.get("qty"));
            if (dateObj == null || qty <= 0.0001) continue;
            int n = jdbc.update("UPDATE dbo.wo_day_plan SET 计划数量 = 计划数量 + ?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE 工单行id=? AND 工序=? AND 计划日期=? AND asp_cancel='N'",
                    qty, user, parentId, op, dateObj);
            if (n == 0) {
                jdbc.update("INSERT INTO dbo.wo_day_plan (工单行id, 工单号, 工单行号, 工序, 计划日期, 计划数量, 生产线,"
                                + " asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,?,?,?,SYSDATETIME(),'N')",
                        parentId, parentNo, parentXc, op, dateObj, qty,
                        str(c.get("line")) == null || str(c.get("line")).isBlank() ? null : str(c.get("line")), user);
            }
            merged++;
        }
        // 子单的格子全部软删(留痕不物理删)
        jdbc.update("UPDATE dbo.wo_day_plan SET 计划数量=0, asp_cancel='Y', asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE 工单行id=? AND asp_cancel='N'", user, childId);
        return merged;
    }

    /**
     * 该道工序的换算率(路线 + 工序);查不到按 1(与报工封顶/台账同一兜底)。
     * <p>2026-10-31:改成 {@code static} 供同包的 ScheduleBoardService 复用(**同一把尺** ——
     * 产能「今日已排」与格子里的日计划都必须用同一个换算率)。
     */
    static double rateOf(JdbcTemplate jdbc, String route, String op) {
        String rt = route == null ? "" : route.trim();
        if (rt.isEmpty() || op == null || op.isBlank()) return 1;
        Double v = jdbc.queryForObject(
                "SELECT MAX(ISNULL(换算率,1)) FROM dbo.bs_route WHERE 工艺路线编码=? AND 工序名称=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y'", Double.class, rt, op);
        return v == null || v <= 0 ? 1 : v;
    }

    // ── 产能可见(2026-10-31 用户口径「产能只显示、不拦截;不影响实际排产量」)────────

    /**
     * 产线日产能({@code bs_prod_line.日产能});0/空 = **未配产能** ⇒ 前端显示"未配"、不判超载。
     *
     * <p>⚠ 本方法只读:任何保存路径都不许拿它拦录入(用户口径「不能堵死录入」)。
     */
    private double dayCapacity(String line) {
        if (str(line).isEmpty()) return 0d;
        List<Double> v = jdbc.queryForList(
                "SELECT ISNULL(日产能,0) FROM dbo.bs_prod_line WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Double.class, line);
        return v.isEmpty() || v.get(0) == null ? 0d : v.get(0);
    }

    /**
     * 该线**每天已排**合计(日期列头「已排/日产能」、顶部「今日超载」):按 {@code plang.scx}(当前归属)算。
     *
     * <p>2026-10-31 起日计划 = 「人工指定 ∪ 自动摊剩余」({@link DayPlanSpread#merge}),这里把**整条线全部
     * 在册行**(不分页签 —— 产能账是整条线的)逐行合并一遍再按日合计:与格子里的日计划、行上的
     * 7天/15天已排**同一把尺**。2026-10-31 下午补:人工改过的格子也要算进来,否则改完数量产能数会偏。
     *
     * <p>按 {@code plang.scx} 而不是 {@code wo_day_plan.生产线}:调拨只改 plang/plang_pc/wo_process_line,
     * 以"活跟工单走"为准。
     */
    private Map<String, Double> lineDailyPlan(String line, List<String> dates, LocalDate today) {
        Map<String, Double> sums = new LinkedHashMap<>();
        String ln = str(line);
        if (ln.isEmpty()) return sums;
        // 该线各行的人工指定(一次查完,别逐行 N+1)
        Map<Long, Map<LocalDate, Double>> manual = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT w.工单行id AS rid, w.计划日期 AS d, SUM(w.计划数量) AS q"
                        + " FROM dbo.wo_day_plan w JOIN dbo.plang p ON p.id = w.工单行id"
                        + " WHERE w.asp_cancel='N' AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'') = ?"
                        + " GROUP BY w.工单行id, w.计划日期", ln)) {
            if (!(r.get("rid") instanceof Number rid)) continue;
            LocalDate d = toDate(r.get("d"));
            if (d == null) continue;
            manual.computeIfAbsent(rid.longValue(), k -> new LinkedHashMap<>()).merge(d, num(r.get("q")), Double::sum);
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS id, ISNULL(p.[当前工序],N'') AS op, ISNULL(p.[工艺路线],N'') AS route,"
                        + " ISNULL(p.pl_sl,0) AS plan_qty, p.st_date AS st, p.cp_date AS cp"
                        + " FROM dbo.plang p"
                        + " WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.scx,N'') = ?", ln);
        // 当前工序为空的行:回落到台账当前道(换算率要靠它);批量查,别 N+1
        List<Long> noOp = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            if (str(r.get("op")).isEmpty() && r.get("id") instanceof Number n) noOp.add(n.longValue());
        }
        Map<Long, String> fallback = noOp.isEmpty() ? Map.of() : ledgerCurrentOp(jdbc, noOp);
        Map<String, Double> rateCache = new HashMap<>();          // 路线|工序 → 换算率
        for (Map<String, Object> r : rows) {
            if (!(r.get("id") instanceof Number idn)) continue;
            String opRaw = str(r.get("op"));
            final String op = opRaw.isEmpty() ? fallback.getOrDefault(idn.longValue(), "") : opRaw;
            final String route = str(r.get("route"));
            double rate = rateCache.computeIfAbsent(route + "|" + op, k -> rateOf(jdbc, route, op));
            double total = round(num(r.get("plan_qty")) * rate);
            Map<LocalDate, Double> merged = DayPlanSpread.merge(total, toDate(r.get("st")), toDate(r.get("cp")),
                    today, manual.getOrDefault(idn.longValue(), Map.of()));
            for (Map.Entry<LocalDate, Double> e : merged.entrySet()) {
                sums.merge(e.getKey().toString(), e.getValue(), Double::sum);
            }
        }
        return slice(sums, dates);
    }

    // ── 行解析 ──────────────────────────────────────────────────────────

    /**
     * 行引用。{@code route} = 该行的工艺路线编码(用来算「工序计划量」= 排产数量 × 该道换算率;空 = 按率 1);
     * {@code start} = 计划开工日(2026-10-31 加:自动均摊的区间起点;空 = 从今天起)。
     */
    private record RowRef(long id, String op, LocalDate due, LocalDate start,
                          double demand, double planQty, String route) { }

    /** 行集:生产工单页按 id 列表(工序取各行当前工序;当前工序空时回落台账当前道);工单排产页按选中产线 */
    private List<RowRef> resolveRows(List<Long> ids, String line, String scope, String workshop) {
        List<RowRef> out = new ArrayList<>();
        if (ids != null && !ids.isEmpty()) {
            Map<Long, String> fallback = ledgerCurrentOp(jdbc, ids);
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT id, ISNULL([当前工序],N'') AS op, CONVERT(varchar(10), cp_date, 120) AS due,"
                            + " ISNULL(xq_sl,0) AS demand, ISNULL(pl_sl,0) AS plan_qty,"
                            + " ISNULL([工艺路线],N'') AS route, CONVERT(varchar(10), st_date, 120) AS st"
                            + " FROM dbo.plang"
                            + " WHERE id IN (" + qs(ids.size()) + ") AND ISNULL(asp_cancel,'N')<>'Y'",
                    ids.toArray())) {
                long id = ((Number) r.get("id")).longValue();
                String op = str(r.get("op"));
                // plang.[当前工序] 可能为空(老数据/未回写)⇒ 用台账"当前道"兜底,否则日计划/日期列会查不到
                if (op.isEmpty()) op = fallback.getOrDefault(id, "");
                out.add(new RowRef(id, op, parseDate(str(r.get("due"))), parseDate(str(r.get("st"))),
                        num(r.get("demand")), num(r.get("plan_qty")), str(r.get("route"))));
            }
            return out;
        }
        String ln = str(line);
        if (ln.isEmpty()) return out;
        String op = processOfLine(ln, workshop);
        List<RowRef> refs = new ArrayList<>();
        Map<Long, Boolean> seen = new LinkedHashMap<>();
        for (Map<String, Object> r : board.scheduled(ln, scope, workshop)) {
            Object ido = r.get("行id");
            if (!(ido instanceof Number n)) continue;
            long id = n.longValue();
            if (seen.putIfAbsent(id, Boolean.TRUE) != null) continue;
            refs.add(new RowRef(id, op, parseDate(str(r.get("计划完工日期"))),
                    parseDate(str(r.get("开工日期"))),
                    num(r.get("需求数量")), num(r.get("排产数量")), ""));
        }
        // 工艺路线是**行级属性**,看板明细 SQL 不返回它 ⇒ 一次批量补齐(别在循环里按行 N+1 查)
        Map<Long, String> routes = routesByIds(refs);
        for (RowRef r : refs) {
            out.add(new RowRef(r.id(), r.op(), r.due(), r.start(), r.demand(), r.planQty(),
                    routes.getOrDefault(r.id(), "")));
        }
        return out;
    }

    /** 行 id → 工艺路线编码(空 = 没绑路线);只查一次,供「工序计划量」按换算率折算 */
    private Map<Long, String> routesByIds(List<RowRef> refs) {
        Map<Long, String> out = new HashMap<>();
        if (refs.isEmpty()) return out;
        List<Long> ids = new ArrayList<>();
        for (RowRef r : refs) if (!ids.contains(r.id())) ids.add(r.id());
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT id, ISNULL([工艺路线],N'') AS route FROM dbo.plang WHERE id IN (" + qs(ids.size()) + ")",
                ids.toArray())) {
            if (r.get("id") instanceof Number n) out.put(n.longValue(), str(r.get("route")));
        }
        return out;
    }

    /**
     * 各行「当前道」(plang.[当前工序] 为空时兜底):台账里**已落实**的工序序最大那道;
     * 一道都没落实的,取工序序最小的第一道。与看板 curOp 同口径。
     * <p>2026-10-31:改成 {@code static}(供同包的 ScheduleBoardService 复用,避免两套兜底逻辑)。
     */
    static Map<Long, String> ledgerCurrentOp(JdbcTemplate jdbc, List<Long> ids) {
        Map<Long, String> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT t.rid AS rid, t.op AS op FROM ("
                        + " SELECT w.工单行id AS rid, ISNULL(w.工序,N'') AS op,"
                        + "   ROW_NUMBER() OVER (PARTITION BY w.工单行id ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC) AS rn"
                        + " FROM dbo.wo_process_line w WHERE w.工单行id IN (" + qs(ids.size()) + ")"
                        + "   AND ISNULL(w.asp_cancel,'N')<>'Y' AND ISNULL(w.状态,N'')=N'已落实') t"
                        + " WHERE t.rn=1", ids.toArray())) {
            if (r.get("rid") instanceof Number n) out.put(n.longValue(), str(r.get("op")));
        }
        List<Long> rest = new ArrayList<>();
        for (Long id : ids) if (!out.containsKey(id)) rest.add(id);
        if (!rest.isEmpty()) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT t.rid AS rid, t.op AS op FROM ("
                            + " SELECT w.工单行id AS rid, ISNULL(w.工序,N'') AS op,"
                            + "   ROW_NUMBER() OVER (PARTITION BY w.工单行id ORDER BY ISNULL(w.工序序,999), w.id) AS rn"
                            + " FROM dbo.wo_process_line w WHERE w.工单行id IN (" + qs(rest.size()) + ")"
                            + "   AND ISNULL(w.asp_cancel,'N')<>'Y') t WHERE t.rn=1", rest.toArray())) {
                if (r.get("rid") instanceof Number n) out.putIfAbsent(n.longValue(), str(r.get("op")));
            }
        }
        return out;
    }

    /** 产线 → 工序(成型/切炭/组装;产线档案车间唯一决定,判不出留空) */
    private String processOfLine(String line, String workshop) {
        String shop = str(workshop);
        if (shop.isEmpty()) {
            List<String> s = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line WHERE 生产线=?", String.class, line);
            shop = s.isEmpty() ? "" : str(s.get(0));
        }
        if ("成型".equals(shop) || "切炭".equals(shop) || "组装".equals(shop)) return shop;
        return "";
    }

    // ── 计划 / 报工 ────────────────────────────────────────────────────

    /**
     * 日期列:按**数据**生成(2026-10-29 用户口径「不存在当前日期的时候不显示这些数据列」)。
     *
     * <p>= 这些行的日计划/日报工出现过的日期 ∪ 各工序台账「计划开工~计划完工」区间。
     * 不再用「今天-N ~ 今天+M」的固定窗口 —— 那样会出现一整排空列。
     * 一行数据都没有时兜底给「今天起 20 天」,否则第一次没法录入。
     *
     * <p><b>2026-10-30 收口</b>(用户报障:工单 10-30 建的,表头却长出 10-20 的列):
     * 日期列是**整张表所有行的并集** ⇒ 别的工单(如 GD-2026-10-0223)有一条 10-20 的历史日计划,
     * 就会给所有行(包括当天才建的工单)长出 10-20 这一列,而那一列对本行永远是空的。
     * ⇒ **今天以前的日期,只有当天真的有已审报工量才出列**(对照历史完成量有用),
     * 否则不显示;今天及以后的日期照旧(计划区间/日计划照常出列)。
     *
     * <p><b>2026-10-31 二次收口</b>(用户报障:日期格里的数对不上行汇总):
     * 只认「已审报工」会把**过去日期的日计划吞掉** —— 计划在、格子不出列 ⇒ 排产员看不见也改不了,
     * 但 7天已排/15天已排/计划合计照样把它算进去。实测 GD-2026-10-0227 行1:10-29、10-30 各 2000,
     * 两列都不出列,而 7天已排/15天已排 显示 6000(表格里只有 10-31 的 2000)。
     * ⇒ 判据改成「**当天有计划 或 有已审报工**」:计划不再凭空消失,数字与格子对得上。
     * 代价:整表并集的老毛病还在(别的行的历史计划也会给本行长列,格子空),已与用户确认接受。
     */
    private List<String> buildDates(List<RowRef> refs,
                                    Map<String, Map<String, Double>> plans,
                                    Map<String, Map<String, Double>> actuals,
                                    LocalDate today) {
        TreeSet<LocalDate> set = new TreeSet<>();
        LocalDate min = today.minusDays(180);
        LocalDate max = today.plusDays(365);
        // 有报工事实 / 有日计划的日期(用于筛掉"过去且两样都没有"的空列)
        Set<LocalDate> doneDates = new HashSet<>();
        Set<LocalDate> planDates = new HashSet<>();
        for (RowRef r : refs) {
            String key = rowKey(r.id, r.op);
            collectDates(set, plans.get(key), min, max);
            collectDates(planDates, plans.get(key), min, max);
            collectDates(set, actuals.get(key), min, max);
            collectDates(doneDates, actuals.get(key), min, max);
        }
        // 工序台账的计划区间(开工~计划完工)整段显示:还没铺日计划的区间也能看到/能录
        Map<Long, Set<String>> opsById = new HashMap<>();
        for (RowRef r : refs) opsById.computeIfAbsent(r.id, k -> new HashSet<>()).add(r.op);
        List<Long> ids = new ArrayList<>();
        for (RowRef r : refs) if (!ids.contains(r.id)) ids.add(r.id);
        if (!ids.isEmpty()) {
            for (Map<String, Object> w : jdbc.queryForList(
                    "SELECT 工单行id AS rid, ISNULL(工序,N'') AS op, 计划开工日期 AS s, 计划完工日期 AS e"
                            + " FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y'"
                            + "   AND 工单行id IN (" + qs(ids.size()) + ")", ids.toArray())) {
                Object ridObj = w.get("rid");
                if (!(ridObj instanceof Number rn)) continue;
                long rid = rn.longValue();
                String op = str(w.get("op"));
                if (!opsById.getOrDefault(rid, Set.of()).contains(op)) continue;
                LocalDate s = toDate(w.get("s"));
                if (s == null) continue;
                LocalDate e = toDate(w.get("e"));
                if (e == null || e.isBefore(s)) e = s;
                if (java.time.temporal.ChronoUnit.DAYS.between(s, e) > RANGE_CAP_DAYS) e = s.plusDays(RANGE_CAP_DAYS);
                for (LocalDate d = s; !d.isAfter(e); d = d.plusDays(1)) {
                    if (!d.isBefore(min) && !d.isAfter(max)) set.add(d);
                }
            }
        }
        List<String> out = new ArrayList<>();
        for (LocalDate d : set) {
            // 过去的日期:当天有计划或有已审报工才出列(2026-10-31:只认报工会把过去的计划吞掉,
            // 计划量却仍计入 7天已排/15天已排 ⇒ 格子与汇总对不上;见方法头注释)
            if (d.isBefore(today) && !planDates.contains(d) && !doneDates.contains(d)) continue;
            out.add(d.toString());
        }
        if (out.size() > MAX_COLUMNS) out = new ArrayList<>(out.subList(out.size() - MAX_COLUMNS, out.size()));
        return out;
    }

    private static void collectDates(Set<LocalDate> set, Map<String, Double> m, LocalDate min, LocalDate max) {
        if (m == null) return;
        for (String k : m.keySet()) {
            LocalDate d = parseDate(k);
            if (d != null && !d.isBefore(min) && !d.isAfter(max)) set.add(d);
        }
    }
    /** 各种日期列(sql date / datetime=Timestamp / 字符串)统一取日期部分;空/非法 → null */
    private static LocalDate toDate(Object o) {
        if (o instanceof java.sql.Date d) return d.toLocalDate();
        if (o instanceof java.sql.Timestamp t) return t.toLocalDateTime().toLocalDate();
        if (o instanceof java.time.LocalDate ld) return ld;
        String s = str(o);
        return parseDate(s.length() > 10 ? s.substring(0, 10) : s);
    }

    /**
     * 合并后的日计划(2026-10-31):key = 行id|工序 → 日期 → 数量。
     *
     * <p>= 「人工指定 ∪ 自动摊剩余」({@link DayPlanSpread#merge})。用户口径「剩余量重摊,总数守恒」:
     * 改过的那天用人工值,其余天按 {@code 工序计划量 − 人工合计} 重摊,合计仍等于工序计划量(除非超分配)。
     *
     * <p>总额 = 工序计划量({@code 排产数量 × 换算率});区间 = 开工日→交期(开工日空 ⇒ 今天起)。
     */
    private static Map<String, Map<String, Double>> mergedPlans(List<RowRef> refs,
                                                                Map<String, Double> opCaps,
                                                                Map<String, Map<LocalDate, Double>> manual,
                                                                LocalDate today) {
        Map<String, Map<String, Double>> out = new LinkedHashMap<>();
        for (RowRef r : refs) {
            String key = rowKey(r.id, r.op);
            Map<String, Double> m = new LinkedHashMap<>();
            for (Map.Entry<LocalDate, Double> e : DayPlanSpread.merge(opCaps.getOrDefault(key, 0d),
                    r.start(), r.due(), today, manual.getOrDefault(key, Map.of())).entrySet()) {
                m.put(e.getKey().toString(), e.getValue());
            }
            out.put(key, m);
        }
        return out;
    }

    /**
     * 人工指定(2026-10-31):key = 行id|工序 → 日期 → 数量。来源 = {@code wo_day_plan} 未作废行。
     *
     * <p>这张表从"全量日计划"改成"**人工指定覆盖表**":只存被人工改过的格子,没行 = 走自动摊。
     */
    private Map<String, Map<LocalDate, Double>> manualByDate(List<Long> ids) {
        Map<String, Map<LocalDate, Double>> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT 工单行id AS rid, ISNULL(工序,N'') AS op, 计划日期 AS d, SUM(计划数量) AS q"
                        + " FROM dbo.wo_day_plan WHERE asp_cancel='N' AND 工单行id IN (" + qs(ids.size()) + ")"
                        + " GROUP BY 工单行id, 工序, 计划日期", ids.toArray())) {
            if (r.get("rid") == null) continue;
            LocalDate d = toDate(r.get("d"));
            if (d == null) continue;
            out.computeIfAbsent(rowKey(((Number) r.get("rid")).longValue(), str(r.get("op"))),
                            k -> new LinkedHashMap<>())
                    .merge(d, num(r.get("q")), Double::sum);
        }
        return out;
    }

    /**
     * 报工(全部日期):key = 行id|工序 → 日期 → 数量。
     * 锚定与看板「当前工序完工量」同口径(gd_id→plang_pc.plang_id;老数据按工单号+批次号兜底)。
     */
    private Map<String, Map<String, Double>> actualByDate(List<Long> ids) {
        Map<String, Map<String, Double>> out = new LinkedHashMap<>();
        if (ids.isEmpty()) return out;
        List<String> nos = jdbc.queryForList(
                "SELECT DISTINCT pl_no FROM dbo.plang WHERE id IN (" + qs(ids.size()) + ")",
                String.class, ids.toArray());
        if (nos.isEmpty()) return out;
        List<Object> args = new ArrayList<>(nos);
        args.addAll(ids);
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT x.rid AS rid, x.op AS op, CONVERT(varchar(10), x.d, 120) AS d, SUM(x.q) AS q FROM ("
                        + " SELECT ISNULL(pc.plang_id, fb.pid) AS rid, ISNULL(s.gxdm,N'') AS op,"
                        + "        CAST(s.sc_date AS date) AS d, ISNULL(s.sl,0) AS q"
                        + " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " OUTER APPLY (SELECT TOP 1 p2.id AS pid FROM dbo.plang p2"
                        + "   WHERE ISNULL(s.gd_id,0)=0 AND p2.pl_no = s.gldh"
                        + "     AND ISNULL(p2.[批次号],N'') = ISNULL(s.[批次号],N'')"
                        + "     AND ISNULL(p2.asp_cancel,'N')<>'Y' ORDER BY p2.id) fb"
                        + " WHERE ISNULL(s.asp_cancel,'N')<>'Y' AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND s.gldh IN (" + qs(nos.size()) + ")"
                        + ") x WHERE x.rid IN (" + qs(ids.size()) + ") GROUP BY x.rid, x.op, x.d", args.toArray())) {
            if (r.get("rid") == null || r.get("d") == null) continue;
            out.computeIfAbsent(rowKey(((Number) r.get("rid")).longValue(), str(r.get("op"))),
                            k -> new LinkedHashMap<>())
                    .merge(str(r.get("d")), num(r.get("q")), Double::sum);
        }
        return out;
    }

    /** 只保留窗口内的日期(0/空不输出) */
    private static Map<String, Double> slice(Map<String, Double> all, List<String> dates) {
        Map<String, Double> out = new LinkedHashMap<>();
        for (String d : dates) {
            Double v = all.get(d);
            if (v != null && v != 0) out.put(d, v);
        }
        return out;
    }

    // ── 小工具 ──────────────────────────────────────────────────────────

    private Map<String, Object> woRow(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP 1 id, pl_no, pl_xc FROM dbo.plang WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static String rowKey(long id, String op) { return id + "|" + (op == null ? "" : op); }

    /** 数量显示(去无意义小数尾巴;守卫报错文案用) */
    private static String trim(double v) {
        double r = Math.round(v * 10000.0) / 10000.0;
        return r == Math.floor(r) ? String.valueOf((long) r) : String.valueOf(r);
    }

    /** 四舍五入到 4 位(与 plang/wo_day_plan 的 decimal 精度一致) */
    private static double round(double v) { return Math.round(v * 10000.0) / 10000.0; }

    /** 宽松日期解析:空/非法 → null(用于展示口径;保存路径另有严格校验) */
    private static LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) return null;
        try { return LocalDate.parse(text.trim()); } catch (RuntimeException e) { return null; }
    }

    private static String qs(int n) { return String.join(",", Collections.nCopies(n, "?")); }

    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (RuntimeException e) { return 0; }
    }

    private static long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        try { return Long.parseLong(str(o)); } catch (RuntimeException e) { return 0; }
    }
}
