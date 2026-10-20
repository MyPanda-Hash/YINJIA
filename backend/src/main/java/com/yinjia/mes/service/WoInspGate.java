package com.yinjia.mes.service;

import com.yinjia.mes.config.DataSourceRouter;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 工序检验单生成门禁的**深模块**(2026-10-19):「**成型完成后的生产工单才能生成检验单**」。
 *
 * <p>用户口径(2026-10-19):「当前首件检验单、制程检验单、组装成品检验单都需要实现当前完成了进行,
 * 成型完成后的生产工单才能生成这个首件检验单,当前实现的所有生产工单都能生成检验单据,修改当前的实现逻辑。」
 * 与《银嘉MES总流程 V1.2》品质泳道一致 —— 图上规则是「**工序质检数据随报工产生**」
 * (成型报工 → 成型质检数据;组装报工 → 组装质检数据),所以判据取「该工序有没有**已审核报工**」,
 * 而不是「排产数量有没有做满」。</p>
 *
 * <p><b>为什么判据取报工记录(scjl)而不是别的表</b>(2026-10-19 两账套实测):
 * ①`wo_process_line`(预排台账)只有排过线的工单才有,正式库 424 行工单里绝大多数没有;
 * ②`wo_progress`(工序任务)两账套**都是 0 行**;③`plang.[当前工序]/[完工状态]` 依赖重算时机,
 * 实测目标行两列皆空;④正式库 424 行的 `scx`(生产线)**全为空**,判据不能依赖产线。
 * ⇒ `scjl` 是唯一有数据的判据面。</p>
 *
 * <p><b>三级锚定(必须,否则判不出来)</b>:正式库实测 `plang_pc` 只有 2 行且 `plang_id` = 1127/1128
 * **全部悬空**(`plang` 最大 id 才 429)⇒ 只按 `gd_id → plang_pc.plang_id` 锚定会一行都取不到
 * (现役 {@code ProcessTaskService.reportedQty} 就是两级口径,在这条数据上取不到)。
 * 故本模块按 ①`scjl.[工单行号]` ②`pc.plang_id`(**且该 plang 行确实存在**) ③`批次号`(非空才比)
 * 依次归属。</p>
 *
 * <p><b>口径开关</b>:{@link #CALIBER} —— {@code REPORTED}(默认,成型有已审核报工即放行,
 * 与流程图「随报工产生」及 C-95「脱模后立马首件检验」一致)/ {@code DONE}(成型达标完工才放行)。
 * 正式库 424 行工单里只有 1 行有成型报工 ⇒ 用 {@code DONE} 会让现场几乎开不出单,故默认 {@code REPORTED}。</p>
 *
 * <p><b>强度开关({@link #policy})</b>:口径(code 常量,决定「算不算完成」)与**强度**(库内配置,决定
 * 「不满足时系统怎么办」)分开 —— 强度写在 `yj_panel.config` 的 {@code "inspGate"} 上:
 * {@code off}(不做门禁)/ {@code warn}(放行但预警 + 留痕)/ {@code block}(422 拦截,默认);
 * 存量行(没有任何已审核报工)另由 {@code "inspGateLegacy"} = {@code pass}(默认)/ {@code block} 控制。
 * 行业依据:ERPNext 的 `action_if_quality_inspection_is_not_submitted` = Stop/Warn、InvenTree 的
 * `PREVENT_BUILD_COMPLETION_HAVING_INCOMPLETED_TESTS`、畅捷通「系统参数」—— 三家独立做出同一个设计:
 * **默认宽松、可收紧,且不靠发版**。读 config 用字符串匹配(库兼容级别 100 无 JSON 函数,
 * 与 {@code PanelConfigService.panelSingleDoc} 同一写法)。</p>
 *
 * <p>调用方(共用同一判据,禁止各写一份):{@code QcProcInspController}、
 * {@code QcFirstInspController} 的 {@code woLines/fromWoLine},以及
 * {@code ButtonService.woInspGenerate} 报工审核出单钩子(判据与单头组装在 {@link QcInspAutoService};
 * 手机端直写走 {@code ExternalReportAbsorbService} → 同一个 build)。</p>
 *
 * <p><b>2026-10-20 口径变更</b>:首件检验单**退出**这道门禁({@link #UNGATED_PANELS})——
 * 用户口径「首件检验单需要关联当前的生产工单即可,不需要实现成型报工完成流程才产生」。
 * 首件改成按「未完工 + 未被本单占用」选工单,见 {@code QcFirstInspController.woLines};
 * 制程/组装成品两张单不变。</p>
 */
public final class WoInspGate {

    private WoInspGate() {}

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(WoInspGate.class);

    /** 门禁前道工序名(与 `bs_route.工序名称`、`scjl.gxdm` 同一份字典值;改工艺口径只改这一处) */
    public static final String GATE_OP = "成型";

    /** 判据口径(见类注释);改口径只改这一行 */
    public static final Caliber CALIBER = Caliber.REPORTED;

    public enum Caliber {
        /** 成型**有已审核报工**即放行(默认;流程图「质检数据随报工产生」) */
        REPORTED,
        /** 成型**达标完工**(已审报工量 ≥ 该道计划量)才放行 */
        DONE
    }

    /** 门禁**强度**档位(库内配置,见 {@link #policy});不满足时的系统行为由它决定 */
    public enum Mode {
        /** 不做门禁(兼容/回滚档) */
        OFF,
        /** 放行但预警(界面确认 + 写 yj_usage_log 留痕) */
        WARN,
        /** 422 拦截(默认;管理员可凭原因强制开单) */
        BLOCK
    }

    /** 强度策略:[0] 档位 [1] 存量行是否也拦 */
    public record Policy(Mode mode, boolean legacyBlock) {}

    /** 库里没配(或读不到)时的默认强度 = 拦截 + 存量放行(与 2026-10-16 之前的代码行为完全一致) */
    public static final Policy DEFAULT_POLICY = new Policy(Mode.BLOCK, false);

    /** 强度配置的读取面:三张检验单任一在 `yj_panel.config` 里写了 `inspGate` 即生效(取第一个非空的,顺序固定) */
    private static final String[] GATE_PANELS = {"QC_FIRST_INSP", "QC_PROC_INSP", "QC_ASM_INSP"};

    /**
     * **不做成型报工门禁的面板**(2026-10-20 用户口径变更)。
     *
     * <p>用户原话:「查看当前系统内的首件检验单的实现,当前是被流程卡死,不完成成型报工就不能产生当前
     * 的首件检验单,当前直接实现对这个 —— 首件检验单需要关联当前的生产工单即可,不需要实现成型报工
     * 完成流程才产生。就是当前检验单能选取工单,未完工的工单就可以选取,但是已经完成的就不需要能被
     * 选取,已经被当前的检验单选取的也不能被再次选取。」</p>
     *
     * <p>⇒ **首件检验单退出「成型已报工」门禁**:准入条件改成「未完工 + 该工单行还没有存活的首件检验单」
     * (见 {@code QcFirstInspController.woLines})。制程检验单、组装成品检验单仍按原口径。</p>
     *
     * <p>为什么开关留在这一个类里、而不把首件那边的调用删干净:判据、强度档位、留痕、强制开单是一整套
     * 深模块,两个控制器的调用点保持同一形状;将来首件若要重新收紧,改这一行即可,不用回控制器重建调用。
     * {@link #CALIBER} 管「算不算完成」,本名单管「这一张单受不受管」。门禁**强度**配置
     * ({@code yj_panel.config} 的 {@code inspGate})对首件从此不再起作用。</p>
     */
    private static final Set<String> UNGATED_PANELS = Set.of("QC_FIRST_INSP");

    /**
     * 该面板的成型报工门禁是否生效。
     * @param panelCode 目标单据面板编码(传 null 视为"受管",不改变既有口径)
     */
    public static boolean gated(String panelCode) {
        return panelCode == null || !UNGATED_PANELS.contains(panelCode);
    }

    /** 配置缓存(按账套;TTL 与 PanelRegistry 一致,改配置最多 30s 生效,免得每次开单都读一次元数据) */
    private static final long POLICY_TTL_MS = 30_000;
    private static final Map<String, Object[]> POLICY_CACHE = new ConcurrentHashMap<>();   // [Policy, loadedAt]

    /**
     * 单个工单行的门禁结论。
     *
     * @param allowed   能否生成检验单(true = 放行)
     * @param warn      **预警放行**(强度 = warn 且判据不满足):能开单,但界面要确认 + 已写留痕
     * @param exempt    **免门禁**(该工单未绑路线 / 路线里没有「成型」工序)—— 放行,但界面要标注
     * @param legacy    **存量兜底**(该行还没有任何已审核报工)—— 放行,但界面要标注
     * @param reason    话术(放行为空串;不放行 = 拦截原因,界面直接显示)
     * @param moldDone  成型已审核完工量
     * @param moldPlan  成型工序计划量(= 本行排产数量 × 该道换算率;取不到为 0)
     * @param mode      本次判定用的强度档位(OFF/WARN/BLOCK)
     */
    public record Status(boolean allowed, boolean warn, boolean exempt, boolean legacy, String reason,
                         double moldDone, double moldPlan, Mode mode) {}

    /** 拦截话术(前端 `tt('…')` 用同一句原文;改文案只改这里) */
    public static final String REASON_NOT_REPORTED =
            "该生产工单行的成型工序尚未报工（成型完工量 0），暂不能生成检验单";
    /** 免门禁话术 */
    public static final String REASON_EXEMPT_NO_ROUTE =
            "该工单未绑工艺路线或路线里没有「成型」工序，本单免门禁";
    /** 存量兜底话术 */
    public static final String REASON_LEGACY =
            "该生产工单行还没有任何已审核报工（存量数据），按现状放行";
    /** 存量行在「存量也拦」口径下的话术 */
    public static final String REASON_LEGACY_BLOCKED =
            "该生产工单行还没有任何已审核报工（存量数据），按当前门禁口径不能生成检验单";

    /**
     * **「选生产工单」列表的准入条件**(2026-10-18 用户口径:
     * 「当前选取的生产工单应该至少排产完成型才能出现」)。
     *
     * <p>⚠ 2026-10-20 起**只有制程检验单**用它 —— 首件检验单退出这道门槛,改成「未完工 + 未被本单占用」
     * (用户口径「未完工的工单就可以选取,已经完成的就不需要能被选取」),见
     * {@code QcFirstInspController.woLines}。</p>
     *
     * <p>现状:制程检验单的手工入口把**全部未作废未结案工单行**都列出来
     * (正式库实测 424 行,其中只有 1 行排过产)⇒ 现场要在几百行里找人。这里加最低门槛:</p>
     * <ol>
     *   <li>{@code plang.scx} 非空 = **已排产入线**;</li>
     *   <li>若该工单行有预排台账({@code wo_process_line}),还要求**「成型」那道已排**(台账存在且未作废);
     *       完全没有台账的行(快速排产只写 {@code plang}/{@code plang_pc} 的路径)按「已排产」放行 ——
     *       成型是标准路线首道,排产即已排成型。</li>
     * </ol>
     *
     * <p>门禁(成型是否已报工)仍由 {@link #check} 逐行判定并在弹窗里标灰,不在这里过滤 ——
     * 否则「排产了但还没报工」的行会整行消失,现场看不到"差什么"。</p>
     *
     * @param alias 外层 {@code dbo.plang} 的别名(调用方固定传 {@code "p"})
     */
    public static String pickable(String alias) {
        String p = alias == null || alias.isBlank() ? "p" : alias;
        return " AND ISNULL(" + p + ".scx,N'') <> N''"
                + " AND (EXISTS (SELECT 1 FROM dbo.wo_process_line l"
                + "              WHERE l.工单号=" + p + ".pl_no AND l.工单行id=" + p + ".id"
                + "                AND l.工序=N'成型' AND ISNULL(l.asp_cancel,'N')<>'Y')"
                + "      OR NOT EXISTS (SELECT 1 FROM dbo.wo_process_line l2"
                + "                     WHERE l2.工单号=" + p + ".pl_no AND l2.工单行id=" + p + ".id"
                + "                       AND ISNULL(l2.asp_cancel,'N')<>'Y'))";
    }

    // ────────────────────────────── 强度配置 ──────────────────────────────

    /**
     * 当前账套的门禁强度(带 30s 缓存;读不到配置就用 {@link #DEFAULT_POLICY})。
     * 配置写在 `yj_panel.config`,例:`{"inspGate":"warn","inspGateLegacy":"pass"}`。
     */
    public static Policy policy(JdbcTemplate jdbc) {
        String ledger = DataSourceRouter.current();
        Object[] cached = POLICY_CACHE.get(ledger);
        long now = System.currentTimeMillis();
        if (cached != null && now - ((Long) cached[1]) < POLICY_TTL_MS) return (Policy) cached[0];
        Policy p = loadPolicy(jdbc);
        POLICY_CACHE.put(ledger, new Object[]{p, now});
        return p;
    }

    /** 配置改动后立即生效(测试/运维用;正常靠 TTL 自然过期) */
    public static void clearPolicyCache() {
        POLICY_CACHE.clear();
    }

    private static Policy loadPolicy(JdbcTemplate jdbc) {
        String cfg;
        try {
            StringBuilder in = new StringBuilder();
            // ⚠ 优先级必须按 GATE_PANELS 的**显式**顺序:面板编码的字母序是 QC_ASM_INSP < QC_FIRST_INSP
            //   < QC_PROC_INSP,若按 panel_code 排,在「首件」面板上改档位会被「组装」面板的老值盖住
            //   (实测踩过:改 QC_FIRST_INSP 无效)⇒ 用 CASE 定序,并把 CASE 的分支与占位符一起生成,
            //   避免「占位符个数与参数个数不一致」——那种错误会被下面的 catch 吞成默认档,表现是"改了没用"。
            StringBuilder ord = new StringBuilder("CASE panel_code");
            for (int i = 0; i < GATE_PANELS.length; i++) {
                in.append(i == 0 ? "?" : ",?");
                ord.append(" WHEN ? THEN ").append(i + 1);
            }
            ord.append(" ELSE ").append(GATE_PANELS.length + 1).append(" END");
            Object[] args = new Object[GATE_PANELS.length * 2];
            for (int i = 0; i < GATE_PANELS.length * 2; i++) args[i] = GATE_PANELS[i % GATE_PANELS.length];
            cfg = jdbc.queryForObject(
                    "SELECT TOP 1 ISNULL(CONVERT(nvarchar(max), config), N'') FROM dbo.yj_panel"
                            + " WHERE panel_code IN (" + in + ")"
                            + "   AND ISNULL(CONVERT(nvarchar(max), config), N'') <> N''"
                            + " ORDER BY " + ord,
                    String.class, args);
        } catch (Exception e) {
            // 元数据读不到(表缺/权限/方言)按默认 —— 但**必须留痕**,否则"改了档位没生效"会变成哑案
            log.warn("读检验单门禁强度配置失败,按默认 {} 处理:{}", DEFAULT_POLICY, e.getMessage());
            return DEFAULT_POLICY;
        }
        String compact = cfg == null ? "" : cfg.replace(" ", "").replace("\r", "")
                .replace("\n", "").replace("\t", "");
        Mode mode = switch (valueOf(compact, "inspGate")) {
            case "off" -> Mode.OFF;
            case "warn" -> Mode.WARN;
            case "block" -> Mode.BLOCK;
            default -> DEFAULT_POLICY.mode();
        };
        // 存量口径:显式写 "inspGateLegacy":"block" 才拦;其余(含未配置)按放行
        boolean legacyBlock = "block".equalsIgnoreCase(valueOf(compact, "inspGateLegacy"));
        return new Policy(mode, legacyBlock);
    }

    /** 从紧凑 JSON 里取字符串值:{"inspGate":"warn"} → warn(取不到返回空串) */
    private static String valueOf(String compactJson, String key) {
        String needle = "\"" + key + "\":\"";
        int i = compactJson.indexOf(needle);
        if (i < 0) return "";
        int from = i + needle.length();
        int to = compactJson.indexOf('"', from);
        return to < 0 ? "" : compactJson.substring(from, to);
    }

    // ────────────────────────────── 对外接口 ──────────────────────────────

    /**
     * 批量判定(**弹窗列表用**,整页一次算完,避免每行 3 条 SQL)。
     *
     * <p>⚠ 入参 rows 必须带这几个键(两个控制器已经这么查):
     * {@code 行id}、{@code 工单号}、{@code 工单行号}、{@code 批次号}、{@code 工艺路线}、{@code 排产数量}。</p>
     *
     * @return key = {@code 工单号#工单行号} → 结论
     */
    public static Map<String, Status> checkPage(JdbcTemplate jdbc, List<Map<String, Object>> rows) {
        Map<String, Status> out = new LinkedHashMap<>();
        if (rows == null || rows.isEmpty()) return out;

        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        Map<Long, Map<String, Object>> byId = new HashMap<>();
        Map<String, Map<String, Object>> byWoBatch = new HashMap<>();
        Set<String> woSet = new LinkedHashSet<>();
        Set<String> routeSet = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            String wo = str(r.get("工单号"));
            String key = key(wo, intOf(r.get("工单行号")));
            byKey.put(key, r);
            long id = (long) num(r.get("行id"));
            if (id > 0) byId.put(id, r);
            String batch = str(r.get("批次号"));
            if (!wo.isEmpty() && !batch.isEmpty()) byWoBatch.putIfAbsent(wo + "@" + batch, r);
            if (!wo.isEmpty()) woSet.add(wo);
            String route = str(r.get("工艺路线"));
            if (!route.isEmpty()) routeSet.add(route);
        }

        // ① 路线 → 该路线里「成型」这道工序的换算率(没有这条记录 = 路线无成型 ⇒ 免门禁)
        Set<String> moldRoutes = new LinkedHashSet<>();
        Map<String, Double> moldRate = new HashMap<>();
        if (!routeSet.isEmpty()) {
            List<Object> args = new ArrayList<>();
            args.add(GATE_OP);
            args.addAll(routeSet);
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT ISNULL(工艺路线编码,N'') AS route, ISNULL(换算率,1) AS rate FROM dbo.bs_route"
                            + " WHERE 工序名称=? AND ISNULL(asp_cancel,'N')<>'Y'"
                            + "   AND 工艺路线编码 IN (" + marks(routeSet.size()) + ")", args.toArray())) {
                String route = str(r.get("route"));
                double rate = num(r.get("rate"));
                moldRoutes.add(route);
                moldRate.put(route, rate <= 0 ? 1d : rate);
            }
        }

        // ② 该页工单号下:成型已审报工量 / 全部已审报工笔数(按 工单号+行号+行id+批次 分组,归属放 Java 侧)
        List<Map<String, Object>> moldGroups = new ArrayList<>();
        List<Map<String, Object>> anyGroups = new ArrayList<>();
        if (!woSet.isEmpty()) {
            Object[] args = woSet.toArray();
            String groupCols = " s.gldh AS wo, ISNULL(s.[工单行号],0) AS xc, ISNULL(pc.plang_id,0) AS rid,"
                    + " ISNULL(s.[批次号],N'') AS batch";
            String from = " FROM dbo.scjl s LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id";
            String where = " WHERE ISNULL(s.wgzt,'N')='Y' AND ISNULL(s.asp_cancel,'N')<>'Y'"
                    + " AND s.gldh IN (" + marks(woSet.size()) + ")";
            String tail = " GROUP BY s.gldh, ISNULL(s.[工单行号],0), ISNULL(pc.plang_id,0), ISNULL(s.[批次号],N'')";
            moldGroups.addAll(jdbc.queryForList(
                    "SELECT" + groupCols + ", SUM(ISNULL(s.sl,0)) AS q" + from + where + " AND s.gxdm=?" + tail,
                    append(args, GATE_OP)));
            anyGroups.addAll(jdbc.queryForList(
                    "SELECT" + groupCols + ", COUNT(*) AS n" + from + where + tail, args));
        }

        // ②b 这些 `plang_pc.plang_id` 里哪些**真的存在**(实测本库 2/2 行悬空 ⇒ 悬空的必须落行号/批次兜底)
        Set<Long> ridSet = new LinkedHashSet<>();
        for (Map<String, Object> g : moldGroups) {
            long rid = (long) num(g.get("rid"));
            if (rid > 0) ridSet.add(rid);
        }
        for (Map<String, Object> g : anyGroups) {
            long rid = (long) num(g.get("rid"));
            if (rid > 0) ridSet.add(rid);
        }
        Set<Long> validRid = new LinkedHashSet<>();
        if (!ridSet.isEmpty()) {
            validRid.addAll(jdbc.queryForList(
                    "SELECT id FROM dbo.plang WHERE id IN (" + marks(ridSet.size()) + ")",
                    Long.class, ridSet.toArray()));
        }

        // ②c 归属到页面行
        Map<String, Double> moldDone = new HashMap<>();
        Map<String, Integer> anyReport = new HashMap<>();
        for (Map<String, Object> g : moldGroups) {
            String k = attributeKey(byId, byKey, byWoBatch, validRid, g);
            if (k != null) moldDone.merge(k, num(g.get("q")), Double::sum);
        }
        for (Map<String, Object> g : anyGroups) {
            String k = attributeKey(byId, byKey, byWoBatch, validRid, g);
            if (k != null) anyReport.merge(k, (int) num(g.get("n")), Integer::sum);
        }

        // ③ 逐行出结论(强度/存量口径见 Policy —— off 直接全放行,warn 放行但预警,block 才拦)
        Policy pol = policy(jdbc);
        for (Map.Entry<String, Map<String, Object>> e : byKey.entrySet()) {
            Map<String, Object> r = e.getValue();
            String route = str(r.get("工艺路线"));
            boolean hasMoldStep = !route.isEmpty() && moldRoutes.contains(route);
            double done = moldDone.getOrDefault(e.getKey(), 0d);
            double plan = hasMoldStep
                    ? round(num(r.get("排产数量")) * moldRate.getOrDefault(route, 1d)) : 0d;
            // 免门禁:未绑路线 / 路线里没有「成型」—— 任何档位下都放行(否则这些工单永远开不出单)
            if (!hasMoldStep) {
                out.put(e.getKey(), new Status(true, false, true, false, REASON_EXEMPT_NO_ROUTE,
                        done, plan, pol.mode()));
                continue;
            }
            // off 档:不做门禁(兼容/回滚用;界面不再显示原因)
            if (pol.mode() == Mode.OFF) {
                out.put(e.getKey(), new Status(true, false, false, false, "", done, plan, Mode.OFF));
                continue;
            }
            // 存量行:该行还没有任何已审核报工 —— 按 inspGateLegacy 决定放行还是拦
            if (anyReport.getOrDefault(e.getKey(), 0) == 0) {
                boolean ok = !pol.legacyBlock();
                out.put(e.getKey(), new Status(ok, false, false, true,
                        ok ? REASON_LEGACY : REASON_LEGACY_BLOCKED, done, plan, pol.mode()));
                continue;
            }
            boolean satisfied = CALIBER == Caliber.DONE
                    ? (plan > 0 ? done + 0.0001 >= plan : done > 0)   // 计划量取不到时退回「有报工即放行」
                    : done > 0;
            if (satisfied) {
                out.put(e.getKey(), new Status(true, false, false, false, "", done, plan, pol.mode()));
            } else if (pol.mode() == Mode.WARN) {
                // 预警放行:能开单,但界面要确认,调用方写 yj_usage_log 留痕
                out.put(e.getKey(), new Status(true, true, false, false, REASON_NOT_REPORTED,
                        done, plan, Mode.WARN));
            } else {
                out.put(e.getKey(), new Status(false, false, false, false, REASON_NOT_REPORTED,
                        done, plan, Mode.BLOCK));
            }
        }
        return out;
    }

    /**
     * 单行判定(**建单前硬校验 / 自动出单钩子用**)。
     *
     * <p>该工单行不存在(或已作废)时**放行**:是否允许建单由各入口原有的存在性校验负责,
     * 门禁只管道序,不抢别人的职责。</p>
     */
    public static Status check(JdbcTemplate jdbc, String wo, Integer xc) {
        if (wo == null || wo.isBlank() || xc == null) return pass();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id AS 行id, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.[批次号],N'') AS 批次号, ISNULL(p.[工艺路线],N'') AS 工艺路线,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量"
                        + " FROM dbo.plang p WHERE p.pl_no=? AND p.pl_xc=? AND ISNULL(p.asp_cancel,'N')<>'Y'",
                wo.trim(), xc);
        if (rows.isEmpty()) return pass();
        return checkPage(jdbc, rows).getOrDefault(key(wo.trim(), xc), pass());
    }

    /** 放行(判不出来时的兜底结论:门禁只管工序,存在性/权限由各入口自己把关;mode=OFF 表示门禁未参与) */
    public static Status pass() {
        return new Status(true, false, false, false, "", 0, 0, Mode.OFF);
    }

    /**
     * 该**工单行**该道工序的已审核报工量 —— **三级锚定**,与门禁判据同一份取数。
     *
     * <p>为什么要有它:现役 {@code ProcessTaskService.reportedQty}(原两级锚定:只管 `pc.plang_id` 与
     * 「`gd_id=0` 时按批次」)在**悬空** `plang_pc` 上两个分支都落空 —— 2026-10-16 实测
     * `GD-2026-10-0007#1` 有 161 件成型报工,它算出来是 **0**,而门禁算出来是 **161**
     * ⇒ 「工序进度」与「门禁」对同一事实给出相反答案。凡按行 id 关联的地方都必须走这一份。</p>
     *
     * @param rowId `plang.id`(工单行 id);传 null/0 时退化为「工单号 + 工序」的整单口径
     */
    public static double reportedQty(JdbcTemplate jdbc, String wo, Long rowId, String op) {
        if (wo == null || wo.isBlank() || op == null || op.isBlank()) return 0;
        int xc = 0;
        String batch = "";
        boolean rowExists = false;
        if (rowId != null && rowId > 0) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    "SELECT ISNULL(pl_xc,0) AS xc, ISNULL([批次号],N'') AS batch FROM dbo.plang"
                            + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId);
            if (!r.isEmpty()) {
                rowExists = true;
                xc = (int) num(r.get(0).get("xc"));
                batch = str(r.get(0).get("batch"));
            }
        }
        List<Object> args = new ArrayList<>();
        args.add(wo.trim());
        args.add(op);
        StringBuilder cond = new StringBuilder();
        if (rowExists) {                                       // ① 有效行 id 锚定(悬空 plang_id 必须落空)
            cond.append(" OR pc.plang_id=?");
            args.add(rowId);
        }
        if (xc > 0) {                                          // ② 工单行号(审核时写定,最可靠)
            cond.append(" OR ISNULL(s.[工单行号],0)=?");
            args.add(xc);
        }
        if (!batch.isEmpty()) {                                // ③ 批次兜底(空批次不比,防 ''='' 恒真)
            cond.append(" OR (ISNULL(s.gd_id,0)=0 AND ISNULL(s.[批次号],N'')=?)");
            args.add(batch);
        }
        if (cond.length() == 0) return 0;
        Double d = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(s.sl,0)),0) FROM dbo.scjl s"
                        + " LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id"
                        + " WHERE s.gldh=? AND s.gxdm=? AND ISNULL(s.wgzt,'N')='Y'"
                        + "   AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND (1=0" + cond + ")",
                Double.class, args.toArray());
        return d == null ? 0 : round(d);
    }

    /** 前端/日志统一用这一句 */
    public static String blockReason(Status s) {
        return s == null || s.allowed() ? "" : s.reason();
    }

    // ────────────────────────────── 内部工具 ──────────────────────────────

    /**
     * 把一组报工归属到页面上的某个工单行,返回该行的 key(归属不到返回 null)。
     * 顺序 = ①行id(gd_id 锚定,**且该 plang 行确实存在**) ②工单行号 ③批次号(非空)。
     * ⚠ 悬空 `plang_pc.plang_id`(实测本库 2/2 行)必须落到 ②/③,否则这条报工就丢了;
     * 而**有效**的 plang_id 锚定优先于行号 —— 若它指向的不是本页的行(别的工单行),直接归属不到,不误挂。
     */
    private static String attributeKey(Map<Long, Map<String, Object>> byId,
                                       Map<String, Map<String, Object>> byKey,
                                       Map<String, Map<String, Object>> byWoBatch,
                                       Set<Long> validRid,
                                       Map<String, Object> g) {
        String wo = str(g.get("wo"));
        if (wo.isEmpty()) return null;
        long rid = (long) num(g.get("rid"));
        if (rid > 0 && validRid.contains(rid)) {
            Map<String, Object> row = byId.get(rid);
            return row == null ? null : rowKey(row);
        }
        int xc = (int) num(g.get("xc"));
        if (xc > 0) {
            String k = key(wo, xc);
            if (byKey.containsKey(k)) return k;
        }
        String batch = str(g.get("batch"));
        if (!batch.isEmpty() && byWoBatch.containsKey(wo + "@" + batch)) {
            return rowKey(byWoBatch.get(wo + "@" + batch));
        }
        return null;
    }

    private static String rowKey(Map<String, Object> row) {
        if (row == null) return null;
        String wo = str(row.get("工单号"));
        if (wo.isEmpty()) return null;
        return key(wo, intOf(row.get("工单行号")));
    }

    public static String key(String wo, Integer xc) {
        return (wo == null ? "" : wo) + "#" + (xc == null ? 0 : xc);
    }

    private static String marks(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(i > 0 ? ",?" : "?");
        return sb.toString();
    }

    private static Object[] append(Object[] base, Object extra) {
        Object[] out = new Object[base.length + 1];
        System.arraycopy(base, 0, out, 0, base.length);
        out[base.length] = extra;
        return out;
    }

    private static String str(Object o) {
        if (o == null) return "";
        String s = String.valueOf(o).trim();
        return "null".equals(s) ? "" : s;
    }

    private static Integer intOf(Object o) {
        double d = num(o);
        return (int) d;
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

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
