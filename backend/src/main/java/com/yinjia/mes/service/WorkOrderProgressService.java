package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 生产工序进度看板(2026-11-08,用户口径「生产工单进度需要做一个看板,方便直观查看工单各工序进度」)。
 *
 * <p><b>口径复用</b>:每行工单的「工序步骤」**不是**本类自己算的 —— 一律调用
 * {@link ProcessTaskService#stepsSummary(String, double, Map, Map, Map)}(即「工单详情·追溯」弹窗
 * 的同一份实现),区别只是本类用**批量查询**把各工单行的已审/待审报工量一次取齐,
 * 避免逐行 N+1 查询。四态判定(已完工/超产/进行中/未开始)、各工序计划量独立折算、当前工序只认已审产出
 * 等口径全部由那一个方法负责,看板与追溯不会出现两套数。
 *
 * <p><b>行级锚定</b>(与 {@link ProcessTaskService#detail(String, Long)} 完全一致):
 * 报工单 scjl 属于哪一工单行 = ① {@code scjl.gd_id → plang_pc.plang_id};② 未锚定(gd_id=0)时按
 * {@code scjl.[工单行号] = plang.pl_xc};③ 仍未锚定时按 {@code scjl.[批次号] = plang.[批次号]}。
 * 同一工单号不同行/不同批次的数据不会串行(2026-10-15 用户报障口径)。
 *
 * <p><b>只读</b>:不改任何业务数据;权限闸门在 Controller(页面级虚拟面板 WORK_ORDER_PROGRESS)。
 */
@Service
public class WorkOrderProgressService {

    /** 看板默认/最大行数:一屏可滚动查看,首页加载不拉全库 */
    private static final int DEFAULT_LIMIT = 300;
    private static final int MAX_LIMIT = 500;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final ProcessTaskService processTask;
    /** 工序检验(首件/制程/组装成品)的批量取数与判定(2026-11-08 看板品质提示/完成质量) */
    private final WorkOrderInspectionService inspection;

    public WorkOrderProgressService(JdbcTemplate jdbc, ProcessTaskService processTask,
                                    WorkOrderInspectionService inspection) {
        this.jdbc = jdbc;
        this.processTask = processTask;
        this.inspection = inspection;
    }

    /**
     * 看板数据:工单行(按「工单号+工单行号」) + 各道工序进度。
     *
     * @param body 可选条件:{@code 状态}(未完工/已完工/全部,默认未完工)、{@code keyword}(工单号/产品/客户/订单号)、
     *             {@code 生产线}、{@code limit}(1~500,默认 300)
     * @return {@code {数据时间, 汇总, 行:[{...工艺路线, 工序步骤:[...], 进度...}]}}
     */
    public Map<String, Object> board(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String state = nz(str(b.get("状态")));
        if (state.isEmpty()) state = "未完工";
        String keyword = str(b.get("keyword"));
        String line = str(b.get("生产线"));
        // 2026-11-23 用户口径「增加未检验的筛选，然后能看到需要检验和没有检验的」:
        //   独立于生产状态(未完工/已完工/全部)的第二筛选,只认 QC 行级判定结果:
        //   · 未检验 = 质检状态 待检验/检验中(还没检验完的单，含缺检);
        //   · 已检验 = 质检状态 合格/不合格;
        //   · 无需检验 对两个筛选都不算(它本来就不该进品质待办)。
        String qcState = nz(str(b.get("检验状态")));
        if (!"未检验".equals(qcState) && !"已检验".equals(qcState)) qcState = "";
        int limit = intOf(b.get("limit"), DEFAULT_LIMIT);
        limit = Math.max(1, Math.min(limit, MAX_LIMIT));

        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N') <> 'Y'");
        if (keyword != null) {
            String like = "%" + keyword + "%";
            w.append(" AND (p.pl_no LIKE ? OR p.mc LIKE ? OR p.dm LIKE ? OR p.khdm LIKE ? OR ISNULL(p.od_no,N'') LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }
        if (line != null) {
            w.append(" AND ISNULL(p.scx, N'') = ?");
            args.add(line);
        }
        // 状态**粗筛**(SQL 只做能下推的部分;精确五态判定在内存用 PlangStatus 统一算,避免两套判据)
        String doneExpr = PlangDone.done("p");
        String closedExpr = PlangClose.closed("p");
        String inFullExpr = "(ISNULL(p.pl_sl,0) > 0 AND ISNULL(p.rk_sl,0) >= ISNULL(p.pl_sl,0))";
        if ("未完工".equals(state)) {
            w.append(" AND NOT ").append(closedExpr)
                    .append(" AND NOT ").append(doneExpr)
                    .append(" AND NOT ").append(inFullExpr);
        } else if ("已完工".equals(state)) {
            w.append(" AND ((").append(closedExpr).append(") OR (").append(doneExpr).append(") OR ").append(inFullExpr).append(")");
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT TOP " + limit + " p.comm AS 公司代码, p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.id AS 行id,"
                        + " ISNULL(p.[批次号], N'') AS 批次号,"
                        + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(p.khdm, N'') AS 客户代码,"
                        + " ISNULL(p.dm, N'') AS 产品编码, ISNULL(p.mc, N'') AS 产品名称, ISNULL(p.gg, N'') AS 规格型号,"
                        + " ISNULL(p.od_no, N'') AS 订单号, " + PlangOrderLine.expr("p") + " AS 订单行号,"
                        + " ISNULL(p.scx, N'') AS 生产线, ISNULL(p.pl_sl, 0) AS 计划数量,"
                        + " ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.rk_sl, 0) AS 入库数量,"
                        // 2026-11-08 用户口径「把当前生产工单主要属性添加进去」:
                        //   生产单位 / 余量(余量口径收口在 PlangRowOccupancy,与生产工单列表同一个 SQL,不另写一套)
                        + " ISNULL(p.jldw, N'') AS 生产单位,"
                        + " " + PlangRowOccupancy.yieldOf("p") + " AS 余量,"
                        + " ISNULL(p.[完工状态], N'') AS 完工状态, " + PlangClose.closedFlag("p") + " AS 结案,"
                        + " ISNULL(p.[工艺路线], N'') AS 工艺路线, ISNULL(p.[当前工序], N'') AS 表头当前工序,"
                        + " CONVERT(varchar(10), p.st_date, 120) AS 计划开工日期,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 计划完工日期"
                        + " FROM dbo.plang p LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm"
                        + PlangOrderLine.join("p")
                        + w
                        + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc", args.toArray());

        // 生产状态(唯一口径 PlangStatus) + 精确状态筛选
        for (Map<String, Object> r : rows) {
            r.put("生产状态", PlangStatus.of(nz(str(r.get("生产线"))), "Y".equalsIgnoreCase(nz(str(r.get("结案")))),
                    r.get("完工状态"), num(r.get("计划数量")), num(r.get("入库数量"))));
        }
        if ("未完工".equals(state)) {
            rows.removeIf(r -> !isActive(str(r.get("生产状态"))));
        } else if ("已完工".equals(state)) {
            rows.removeIf(r -> isActive(str(r.get("生产状态"))));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("数据时间", LocalDateTime.now().format(TS));
        if (rows.isEmpty()) {
            out.put("汇总", summary(0, 0, 0));
            out.put("行", List.of());
            return out;
        }

        // ── 批量取报工量 + 当前工序台账 + 路线,再逐行套用追溯的工序步骤口径 ──
        Set<String> noSet = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) noSet.add(nz(str(r.get("工单号"))));
        List<String> nos = new ArrayList<>(noSet);
        String in = placeholders(nos.size());

        List<Map<String, Object>> aggs = jdbc.queryForList(
                "SELECT s.gldh AS 工单号, ISNULL(pc.plang_id, 0) AS 行id,"
                        + " ISNULL(s.[工单行号], 0) AS 行号, ISNULL(s.[批次号], N'') AS 批次号,"
                        + " ISNULL(s.gxdm, N'') AS 工序,"
                        + " SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN ISNULL(s.sl,0) ELSE 0 END) AS 完工量,"
                        + " SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN 0 ELSE ISNULL(s.sl,0) END) AS 待审量,"
                        + " SUM(CASE WHEN ISNULL(s.wgzt,'N')='Y' THEN 1 ELSE 0 END) AS 报工单数,"
                        + " SUM(CASE WHEN ISNULL(s.gd_id,0)=0 THEN 1 ELSE 0 END) AS 未锚计数"
                        + " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " WHERE s.gldh IN (" + in + ") AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + " GROUP BY s.gldh, ISNULL(pc.plang_id,0), ISNULL(s.[工单行号],0),"
                        + "          ISNULL(s.[批次号],N''), ISNULL(s.gxdm,N'')", nos.toArray());

        List<Map<String, Object>> ledger = jdbc.queryForList(
                "SELECT w.工单号 AS 工单号, w.工单行id AS 行id, w.工序 AS 工序"
                        + " FROM dbo.wo_process_line w"
                        + " WHERE w.工单号 IN (" + in + ") AND ISNULL(w.asp_cancel,'N')<>'Y'"
                        + "   AND ISNULL(w.状态,N'') = N'已落实'"
                        + " ORDER BY ISNULL(w.工序序,999) DESC, w.id DESC", nos.toArray());

        // ── 预排台账(2026-11-13,契约 §2)──────────────────────────────────────────────
        // 用途:给每道工序补「生产线 / 台账状态 / 已排产」三个**展示字段**(工序点击要跳工单排产的对应线)。
        // ⚠ 与上面那条 ledger 查询**刻意分开、互不影响**:上面那条只认「已落实」、按工序序 DESC 取第一条,
        //   是「当前工序」的唯一口径(currentProcessOf),牵动看板汇总与生产工单列表,**一行都不能动**;
        //   这一条把未作废的**全部**台账行取回来(计划/已落实/已完工都算),只做工序级映射,不改任何口径。
        List<Map<String, Object>> schedRows = jdbc.queryForList(
                "SELECT w.工单号 AS 工单号, w.工单行id AS 行id, ISNULL(w.工序, N'') AS 工序,"
                        + " ISNULL(w.计划生产线, N'') AS 计划生产线, ISNULL(w.实际生产线, N'') AS 实际生产线,"
                        + " ISNULL(w.状态, N'') AS 状态"
                        + " FROM dbo.wo_process_line w"
                        + " WHERE w.工单号 IN (" + in + ") AND ISNULL(w.asp_cancel,'N')<>'Y'"
                        + " ORDER BY w.工单行id, ISNULL(w.工序序,999), w.id", nos.toArray());

        // 工单号 → 该单的行;行id → 行;行id → 报工累计
        Map<String, List<Map<String, Object>>> byNo = new HashMap<>();
        Map<Object, Map<String, Object>> byRowId = new HashMap<>();
        for (Map<String, Object> r : rows) {
            byNo.computeIfAbsent(nz(str(r.get("工单号"))), k -> new ArrayList<>()).add(r);
            byRowId.put(numKey(r.get("行id")), r);
        }
        Map<Object, Map<String, Double>> qtyByRow = new HashMap<>();
        Map<Object, Map<String, Double>> pendByRow = new HashMap<>();
        Map<Object, Map<String, Integer>> cntByRow = new HashMap<>();
        for (Map<String, Object> a : aggs) {
            long plangId = (long) num(a.get("行id"));
            int xc = (int) num(a.get("行号"));
            double unanchored = num(a.get("未锚计数"));
            String op = nz(str(a.get("工序")));
            if (op.isEmpty()) continue;
            List<Object> targets = new ArrayList<>();
            if (plangId > 0) {
                targets.add(numKey(plangId));
            } else if (unanchored > 0) {
                String no = nz(str(a.get("工单号")));
                String batch = nz(str(a.get("批次号")));
                for (Map<String, Object> r : byNo.getOrDefault(no, List.of())) {
                    if (xc > 0 && (long) num(r.get("工单行号")) == xc) targets.add(numKey(r.get("行id")));
                    else if (xc == 0 && !batch.isEmpty() && batch.equals(nz(str(r.get("批次号"))))) {
                        targets.add(numKey(r.get("行id")));
                    }
                }
            }
            for (Object key : targets) {
                if (!byRowId.containsKey(key)) continue;    // 报工挂在未列出的行(已结案/已过滤)上,忽略
                qtyByRow.computeIfAbsent(key, k -> new LinkedHashMap<>()).merge(op, num(a.get("完工量")), Double::sum);
                pendByRow.computeIfAbsent(key, k -> new LinkedHashMap<>()).merge(op, num(a.get("待审量")), Double::sum);
                cntByRow.computeIfAbsent(key, k -> new LinkedHashMap<>()).merge(op, (int) num(a.get("报工单数")), Integer::sum);
            }
        }

        Map<String, List<Map<String, Object>>> ledgerByNo = new HashMap<>();
        for (Map<String, Object> l : ledger) {
            ledgerByNo.computeIfAbsent(nz(str(l.get("工单号"))), k -> new ArrayList<>()).add(l);
        }

        // 工序级台账映射(2026-11-13):行级 key = 工单行id;工单级(工单行id IS NULL)另放一张表做兜底。
        //   值 = 工序 → {生产线, 台账状态};同一工序有多条未作废台账行时取**进度最靠后**的一条
        //   (实际生产线要等「已落实」才回填,取最靠后才拿得到真正投的线;同级取先出现者,确定性仍由 ORDER BY 保证)。
        Map<Object, Map<String, Map<String, Object>>> schedByRow = new HashMap<>();
        Map<String, Map<String, Map<String, Object>>> schedByOrder = new HashMap<>();
        for (Map<String, Object> l : schedRows) {
            String op = nz(str(l.get("工序")));
            if (op.isEmpty()) continue;                                  // 工序为空的脏行不参与
            String planLine = nz(str(l.get("计划生产线")));
            String actLine = nz(str(l.get("实际生产线")));
            String lstate = nz(str(l.get("状态")));
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("生产线", actLine.isEmpty() ? planLine : actLine);    // 实际生产线非空优先,否则计划生产线
            one.put("台账状态", lstate);
            one.put("_rank", ledgerRank(lstate));
            Object lid = l.get("行id");
            Map<String, Map<String, Object>> target = lid == null
                    ? schedByOrder.computeIfAbsent(nz(str(l.get("工单号"))), k -> new HashMap<>())
                    : schedByRow.computeIfAbsent(numKey(lid), k -> new HashMap<>());
            Map<String, Object> old = target.get(op);
            if (old == null || (int) old.get("_rank") <= (int) one.get("_rank")) target.put(op, one);
        }

        // 工序检验单(2026-11-08):批量取三张工序检验单并按工单行归属 —— 用于工序步骤上的
        // 「待品质检验」提示与完工后「合格绿/不合格红」结论(只认已审核单据,弃审后结果自动回退)
        Map<Long, List<Map<String, Object>>> inspByRow = inspection.docsByRow(rows);

        // 路线缓存:同一路线只查一次 bs_route(看板常见只有 2~3 条路线)
        Map<String, List<Map<String, Object>>> routeCache = new HashMap<>();
        int active = 0;
        int finished = 0;
        /** 有待品质检验工序(应检未完成)的工单行数 */
        int waiting = 0;
        double progressSum = 0;
        for (Map<String, Object> r : rows) {
            Object key = numKey(r.get("行id"));
            String route = nz(str(r.get("工艺路线")));
            List<Map<String, Object>> lines = routeCache.computeIfAbsent(route, processTask::routeLines);
            Map<String, Object> summary = processTask.stepsSummary(lines, num(r.get("计划数量")),
                    qtyByRow.get(key), pendByRow.get(key), cntByRow.get(key));
            String st = str(r.get("生产状态"));
            r.put("当前工序", currentProcessOf(nz(str(r.get("工单号"))), key, r, ledgerByNo));
            r.put("工序步骤", summary.get("工序步骤"));
            r.put("已完成步骤数", summary.get("已完成步骤数"));
            r.put("产出", summary.get("产出"));
            r.put("进度", summary.get("进度"));
            r.put("未完成合计", summary.get("未完成合计"));
            // 工序检验状态(应检工序:成型=首件+制程、组装=组装成品)+ 行级质检状态/汇总/待检验工序
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> steps = (List<Map<String, Object>>) summary.get("工序步骤");
            inspection.attach(r, steps, inspByRow.getOrDefault((long) num(r.get("行id")), List.of()));
            // 每步补「生产线 / 台账状态 / 已排产」(契约 §2,2026-11-13):
            //   匹配顺序与 currentProcessOf 一致 —— 本行 工单行id = 行.行id 优先,工单级(工单行id IS NULL)兜底;
            //   都不命中 = **无台账**(生产线/台账状态给 '',已排产 false),不猜、不回落到 行.生产线 ——
            //   前端要靠这两个空值区分「该工单未进行排产」与「排了产但这条线还没填」。
            Map<String, Map<String, Object>> rowSched = schedByRow.getOrDefault(key, Map.of());
            Map<String, Map<String, Object>> orderSched =
                    schedByOrder.getOrDefault(nz(str(r.get("工单号"))), Map.of());
            for (Map<String, Object> step : steps) {
                String op = nz(str(step.get("工序")));
                Map<String, Object> s = rowSched.get(op);
                if (s == null) s = orderSched.get(op);                   // 行级没排到才落工单级兜底
                step.put("生产线", s == null ? "" : nz(str(s.get("生产线"))));
                step.put("台账状态", s == null ? "" : nz(str(s.get("台账状态"))));
                step.put("已排产", s != null);
            }
            if (!((List<?>) r.getOrDefault("待检验工序", List.of())).isEmpty()) waiting++;
            if (isActive(st)) active++; else finished++;
            progressSum += num(summary.get("进度"));
        }
        // 检验状态筛选(2026-11-23):在 QC 判定挂到行上之后过滤,再按**过滤后的行**重算汇总,
        // 否则顶部统计(行数/未完工/已完工/平均进度/待检验行数)会与被筛掉的列表对不上。
        if (!qcState.isEmpty()) {
            final String want = qcState;
            rows.removeIf((r) -> !qcMatches(r, want));
            active = 0;
            finished = 0;
            waiting = 0;
            progressSum = 0;
            for (Map<String, Object> r : rows) {
                if (!((List<?>) r.getOrDefault("待检验工序", List.of())).isEmpty()) waiting++;
                if (isActive(str(r.get("生产状态")))) active++; else finished++;
                progressSum += num(r.get("进度"));
            }
        }
        out.put("汇总", summary(rows.size(), active, finished,
                rows.isEmpty() ? 0 : Math.round(progressSum / rows.size() * 100d) / 100d, waiting));
        out.put("行", rows);
        return out;
    }

    /** 本行「当前工序」:预排台账最后一道已落实(行级优先,工单级兜底)= 生产工单列表同口径;缺台账回落本行 p.当前工序 */
    private static String currentProcessOf(String no, Object rowKey, Map<String, Object> row,
                                           Map<String, List<Map<String, Object>>> ledgerByNo) {
        for (Map<String, Object> l : ledgerByNo.getOrDefault(no, List.of())) {
            Object lid = l.get("行id");
            boolean rowLevel = lid != null && numKey(lid).equals(rowKey);
            boolean wholeOrder = lid == null;
            if (rowLevel || wholeOrder) {
                String op = nz(str(l.get("工序")));
                if (!op.isEmpty()) return op;
            }
        }
        return nz(str(row.get("表头当前工序")));
    }

    /**
     * 预排台账状态权重(2026-11-13,只服务工序步骤的「生产线/台账状态」展示字段):
     * 同一工序存在多条未作废台账行时,取**进度最靠后**的一条 —— 计划 &lt; 已落实 &lt; 已完工。
     * 依据:{@code 实际生产线} 是「落实」动作回填的,计划态那行只有计划线;取最靠后才拿得到真正投的线。
     * 未知/空状态给 0(等同不覆盖已有值)。
     */
    private static int ledgerRank(String state) {
        if ("已完工".equals(state)) return 3;
        if ("已落实".equals(state)) return 2;
        if ("计划".equals(state)) return 1;
        return 0;
    }

    private static Map<String, Object> summary(int total, int active, int finished) {
        return summary(total, active, finished, 0, 0);
    }

    private static Map<String, Object> summary(int total, int active, int finished, double avgProgress) {
        return summary(total, active, finished, avgProgress, 0);
    }

    private static Map<String, Object> summary(int total, int active, int finished, double avgProgress, int waiting) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("行数", total);
        s.put("未完工行数", active);
        s.put("已完工行数", finished);
        s.put("平均进度", avgProgress);
        s.put("待检验行数", waiting);
        return s;
    }

    /** 生产状态是否属于「未完工」侧(未排产/未完工/在产);已结案/完工为另一侧 */
    /**
     * 检验状态筛选判定(2026-11-23):未检验 = 还没得出合格/不合格结论(待检验/检验中/缺字段);
     * 已检验 = 合格/不合格。无需检验两边都不算。
     */
    private static boolean qcMatches(Map<String, Object> row, String want) {
        String s = nz(str(row.get("质检状态")));
        if ("无需检验".equals(s)) return false;
        boolean inspected = "合格".equals(s) || "不合格".equals(s);
        return "已检验".equals(want) == inspected;
    }

    private static boolean isActive(String productionState) {
        if (productionState == null) return true;
        return !("已结案".equals(productionState) || "完工".equals(productionState));
    }

    /** 行 key:Number -> Long(避免 Integer/Long 混用导致 Map 查不到) */
    private static Object numKey(Object v) {
        return (long) num(v);
    }

    private static String placeholders(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append(',');
            sb.append('?');
        }
        return sb.toString();
    }

    private static int intOf(Object o, int dft) {
        if (o == null) return dft;
        if (o instanceof Number n) return n.intValue();
        try {
            return (int) Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

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
