package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产排产域服务:销售订单 → 生产工单({@link #generateFromOrder}/{@link #createFromOrderLine},
 * SO_ORDER「生成生产工单」按钮),落 {@code plang},数量守恒靠 form_flow_link.linked_quantity。
 *
 * <p>2026-10-28:旧「生产加工单 MANU_ORDER」下架,原 {@code scheduleOne}(回写 bd_manu_order/bl_manu_order)
 * 一并删除 —— 排产单一入口是「快速排产 / 生产工单」页(Plang 单轨,见 ScheduleBoardService.assign)。
 * 本类不再承担排产回写。
 *
 * <p>🔴 2026-10-31 转单口径(用户拍板,替代「同一销售订单共用一张工单」):
 * <b>一次转单 = 一张新工单号</b>(GD-YYYY-MM-NNNN,取号走 {@link FormNoService});
 * 工单上写 订单号 + **订单行号**({@code od_no}/{@code od_xc}),工单行号 {@code pl_xc} 也取订单行号
 * ⇒ 同一订单行分多次转单时,每张工单各自一行、行号稳定(不再出现 MAX(pl_xc)+1 的漂移),
 * 靠 od_no/od_xc 回溯销售订单行。每张工单的 需求数量/转单数量 都等于**本次转单数量**
 * (旧实现写整条订单行数量 ⇒ 同一订单行转两次就各带一份整单需求,需求被重复计)。
 *
 * <p>🔴 2026-11-08 用户口径(备品):订单结转页的「本次转单数量」**允许超过销售订单数量**
 * (备品场景);该数量由 UI 明确给出(qtyOverride>0)时按原值落工单,不再截断到剩余可转量,
 * 只有整单按行生成(qtyOverride 空)时才沿用「剩余全部」口径。详见
 * {@link #createFromOrderLine(String, String, Double, String, String)} 的 javadoc 与方法内注释。
 */
@Service
public class QuickScheduleService {

    private final JdbcTemplate jdbc;
    private final FormNoService formNo;
    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    /** 工序任务(路线驱动,A 项):转工单即按工艺路线生成各工序任务 */
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(QuickScheduleService.class);
    private final ProcessTaskService processTask;

    public QuickScheduleService(JdbcTemplate jdbc, FormNoService formNo, PanelRegistry registry, QueryService queryService,
                                ButtonService buttonService, VoucherFlowService voucherFlow,
                                ProcessTaskService processTask) {
        this.jdbc = jdbc;
        this.formNo = formNo;
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.processTask = processTask;
    }

    // ────────────────────────── ① 销售订单 → 生产工单(一单可多次生成多张) ──────────────────────────

    /**
     * 整单按行生成工单草稿(**每行一张新工单号**,增量:剩余为 0 的行跳过),返回新单号清单;
     * 支持同一行反复点击多次生成。
     *
     * <p>2026-10-31:用户口径「销售订单 → 生产工单、生产工单 → 产成品入库单这两个保持原来的不变」
     * ⇒ 本链路**不进统一生单对话框**(不勾行、不填量),这里保持原实现不动。
     * 注:它经 {@code createFromOrderLine(...)} 的 4 参重载调用,而该重载传 route=null,
     * 会被 2026-10-16 加的「工艺路线须已审核」闸门拒绝 —— 这是既有行为,本次按用户要求未改。
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public List<String> generateFromOrder(String sourceNo, String user) {
        requireAudited(sourceNo);
        PanelRegistry.PanelDef soDef = registry.panel("SO_ORDER");
        Map<String, Object> src = queryService.loadOneDoc(soDef, sourceNo);
        Object detailObj = src.get("detail");
        List<Map<String, Object>> lines = new ArrayList<>();
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) lines.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        if (lines.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生成生产工单");
        List<String> created = new ArrayList<>();
        for (Map<String, Object> line : lines) {
            String lineId = str(line.get("id"));
            if (lineId == null) continue;
            if (residual(sourceNo, lineId, line) <= 0.0001) continue;   // 剩余为 0:已生成的行跳过
            created.add(createFromOrderLine(sourceNo, lineId, null, user));
        }
        if (created.isEmpty()) throw new IllegalStateException("该订单明细行均已生成生产工单,无需重复生成(如需调整请先删除对应工单草稿)");
        return created;
    }

    /**
     * 单行 → **一张新工单**(2026-10-31 用户拍板,取代 2026-09-27 的「同一销售订单共用一张工单」):
     * <ul>
     *   <li><b>每次转单取新工单号</b>(GD-YYYY-MM-NNNN,{@link FormNoService});同一订单行转几次就是几张工单,
     *       各自可独立排产/报工/打印/结案;</li>
     *   <li><b>工单行号 pl_xc = 订单行号</b>({@code bl_so_order.行号});每张新工单只有这一行,
     *       所以同一订单行多次转单时行号稳定(旧实现复用单号时取 MAX(pl_xc)+1 ⇒ 第二次转单行号变 2);</li>
     *   <li><b>订单追溯</b>:{@code od_no = 销售订单号},{@code od_xc = 订单行 id}(沿用历史口径,
     *       工单列表/追溯按它 join 出「订单行号」);{@code pl_xc} 本身即订单行号 ⇒ 工单自带订单号+订单行号;</li>
     *   <li><b>数量</b>:{@code xq_sl(需求) = pl_sl(转单) = 本次转单数量},{@code yl(余量)=0}
     *       —— 旧实现把 xq_sl 写成整条订单行数量,同一订单行分两次转 ⇒ 两张工单各带 200 需求、
     *       订单需求被重复计(2026-10-30 用户报障);</li>
     *   <li>占用链仍是行级 form_flow_link(SO 订单行 → 本工单行,数量 = 本次转单数量),
     *       订单结转页「已排产/剩余数量」口径不变。</li>
     * </ul>
     * 严格「已审核」闸门;剩余=行数量−各通道占用。
     *
     * <p>🔴 2026-11-08 用户口径(备品):行上**明确给出本次转单数量**(qtyOverride>0,订单结转页 生单数量)
     * 时,允许该数量**超过销售订单数量 / 剩余可转数量**(备品),原样落库、不再 Math.min 截断、不再报
     * 「超过剩余可转数量」,剩余为负/0 的行上给了数量也允许追加(备品追加);qtyOverride 为空/<=0
     * (SO_ORDER 按钮整单按行生成)时保持原口径:qty=residual,residual<=0 报「已全部转出」。
     * 实现见方法体内 2026-11-08 注释段。
     * 数据源单轨:不再写 bd_manu_order。SO_ORDER「生成生产工单」按钮与订单结转页共用本实现。
     */
    @Transactional
    /** 4 参重载(不指定路线):路线取产品绑定 → 否则默认 GY-CB-STD */
    public String createFromOrderLine(String sourceNo, String lineId, Double qtyOverride, String user) {
        return createFromOrderLine(sourceNo, lineId, qtyOverride, user, null);
    }

    /**
     * @param route 订单结转时选择的工艺路线(2026-10-05 用户口径:在**订单结转**处选路线);
     *              空 = 回退产品档案绑定(bs_inv.工艺路线)→ 否则默认 GY-CB-STD
     */
    public String createFromOrderLine(String sourceNo, String lineId, Double qtyOverride, String user, String route) {
        requireAudited(sourceNo);
        // 🔴 工艺路线必须审核完成后才能被使用(2026-10-16 用户口径「当前能工艺路线需要被
        //   审核完成后才能被使用」)。拦住的是**生成工单这一步**：订单结转/快速排产选定的路线
        //   若未审核，直接拒绝 —— 否则未评审的工序/换算率/质检配置会一路带到工单、报工、入库。
        //   ⚠ 只拦"转工单"，不拦已在产的老工单(它们投产时按当时口径建的，见
        //     tools/migrate-route-must-audited-20261016.sql 的存量基线补齐)。
        //   空路线也一并拦(与 OrderConvertService 的前置提示同口径，这里是服务端兜底，
        //   防直连 /px/callButton 绕过前端校验)。
        if (route == null || route.isBlank()) {
            throw new IllegalStateException("未选择工艺路线，不能转工单;请先在订单结转处选择工艺路线");
        }
        requireRouteAudited(route.trim());
        // 订单行直查表(不走面板标签映射);来源单头取 客户编码;行号带 id 序兜底(历史行 行号 可能为空)
        Map<String, Object> line = jdbc.queryForMap(
                "SELECT l.[存货编码], ISNULL(l.[存货名称],N'') AS 存货名称, ISNULL(l.[规格型号],N'') AS 规格型号,"
                        + " ISNULL(l.[数量],0) AS 数量, ISNULL(l.[销售单位],N'') AS 销售单位, ISNULL(l.[批次号],N'') AS 批次号,"
                        + " ISNULL(o.[客户编码],N'') AS 客户编码,"
                        + " ISNULL(l.[行号], (SELECT COUNT(*) FROM bl_so_order x WHERE x.[单据编号]=l.[单据编号]"
                        + "   AND ISNULL(x.asp_cancel,'N')<>N'Y' AND x.[id]<=l.[id])) AS 行号,"
                        + " CONVERT(varchar(10), ISNULL(l.[预计交货日期], o.[预计交货日期]), 120) AS 交货日期"
                        + " FROM bl_so_order l JOIN bd_so_order o ON o.[单据编号] = l.[单据编号]"
                        + " WHERE l.[单据编号] = ? AND l.[id] = ?", sourceNo, Integer.parseInt(lineId));
        Double manu = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND source_line_key=?"
                        + " AND target_panel_code IN ('MANU_ORDER','PLANG') AND link_status='ACTIVE'",
                Double.class, sourceNo + "#" + lineId);
        // 2026-10-08:原「SO_ORDER → PU_REQ(请购单)」也占剩余量的口径随请购单下架移除 ——
        // 订单行的剩余可转量现在只看 工单/排产(MANU_ORDER/PLANG)的占用
        double demand = Num.of(line.get("数量"));
        double residual = demand - (manu == null ? 0 : manu);
        // 🔴 2026-11-08 用户口径(备品):「本次转单数量」允许**超过销售订单数量**。
        //   ① 行上明确给了数量(订单结转页传 生单数量 ⇒ qtyOverride>0)⇒ **以它为准原样落库**:
        //      不再 Math.min 截断到剩余量、不再报「超过剩余可转数量」;剩余为负/0(该行已转满)
        //      也允许追加 —— 这正是备品场景(备注:备品追加),超出部分同样计入本行占用
        //      (form_flow_link.linked_quantity 落**实际转单量**,见下方 linkLine 调用)。
        //   ② qtyOverride 为空/<=0(SO_ORDER 按钮整单按行生成 generateFromOrder 传 null)⇒ 保持原口径:
        //      qty = residual,residual<=0 报「已全部转出」(整单生成不允许凭空多转)。
        boolean uiQty = qtyOverride != null && qtyOverride > 0;
        double qty;
        if (uiQty) {
            qty = qtyOverride;
            if (qty > residual + 0.0001) {
                log.info("[订单结转] 备品转单(2026-11-08 口径):订单 {}#{} 本次转单 {} 超过剩余可转 {}",
                        sourceNo, lineId, qty, residual);
            }
        } else {
            if (residual <= 0.0001) {
                throw new IllegalStateException("该订单行已全部转出(剩余可转数量 0)");
            }
            qty = residual;
        }
        if (qty <= 0) throw new IllegalStateException("生单数量必须大于 0");
        // ── 工单号 / 行号 / 数量(2026-10-31 新口径,口径说明见方法 javadoc)──────────────────────
        // 每次转单**直接取新工单号**:不再按 od_no 复用「该订单已有工单号」。
        // 旧实现(2026-09-27~2026-10-30)一张订单共用一张工单,复用时的行号只能取 MAX(pl_xc)+1 ⇒
        //   同一订单行第二次转单就变成同单里的 #2(与订单行号无关),用户报障「第二次转工单的行号被改了」。
        // 生产工单前缀 MO → GD(2026-10-05 用户口径「修改生产工单」):只影响新单号,历史单号不变;
        // 取号流水在 s_allno(按 前缀+年月 独立序列),不与旧前缀混号。
        String plNo = formNo.next("GD", user);
        // 工单行号 = 订单行号(bl_so_order.行号,金蝶分录 seq);每张新工单只有这一行,不会撞号。
        Integer lineNo = line.get("行号") instanceof Number n ? n.intValue() : 1;
        if (lineNo == null || lineNo <= 0) lineNo = 1;
        String batch = null; // 生产批次在工单行首次生产完工时生成
        String due = str(line.get("交货日期"));
        // 需求数量 = 本次转单数量(本工单行自己的需求),余量 0。
        // ⚠ 不能再写整条订单行的数量:同一订单行分多次转单时,每张工单都会带一份整单需求 ⇒ 需求重复计
        //   (2026-10-30 用户报障:同一订单行转 100+100,两张工单各显示「需求 200」)。
        //   订单行层面的「已转/剩余」由 form_flow_link 汇总给出(订单结转页),不靠工单行重复表达。
        double remain = 0;
        jdbc.update("INSERT INTO plang (comm, pl_no, pl_xc, pl_date, khdm, dm, mc, gg, jldw,"
                        + " xq_sl, pl_sl, yl, cp_date, lot_no, od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1, [批次号], [工艺路线])"
                        + " VALUES (N'0', ?, ?, GETDATE(), ?, ?, ?, ?, ?, ?, ?, ?,"
                        + " CASE WHEN ? IS NULL OR ? = N'' THEN NULL ELSE CONVERT(datetime, ?, 120) END,"
                        + " ?, ?, CONVERT(float, ?), 'N', 'N', ?, GETDATE(), ?, ?)",
                plNo, lineNo, str(line.get("客户编码")), str(line.get("存货编码")), str(line.get("存货名称")),
                str(line.get("规格型号")), str(line.get("销售单位")), qty, qty, remain, due, due, due,
                // od_no=销售订单号;od_xc 沿用历史口径存**订单行 id**(bl_so_order.id,精确关联,
                // 工单列表/追溯按它 join 出「订单行号」显示)。
                null, sourceNo, Integer.parseInt(lineId), user, null,
                // 工单关联工艺路线(2026-10-05):**用订单结转所选,不兜底默认**(用户口径「不需要实现默认选择」);
                // 未选 = NULL,后续不推导"下一道工序",由经办人补选后再排产
                (route != null && !route.isBlank()) ? route.trim() : null);
        // 工序台账(2026-10-21 用户口径:「工艺路线是在工单结转的时候选择的,选择完后工单跟着走」):
        //   转单后立刻按**结转时选的路线**建 wo_process_line,否则「结转过但没预排产」的工单在
        //   工序报工页面看不到任何工序、现场报不了工。计划生产线留空,后续预排产再派线。
        //   幂等:该行已有有效台账(已预排产)则跳过;失败不阻断转单(台账可事后补)。
        try {
            int n = processTask.ensureLedgerForWorkOrder(plNo, route, user);
            if (n > 0) log.info("[订单结转] 工单 {} 按路线 {} 建工序台账 {} 道", plNo, route, n);
        } catch (Exception e) {
            log.warn("[订单结转] 工单 {} 建工序台账失败(不阻断转单): {}", plNo, e.getMessage());
        }
        // 行级占用链落**实际转单量** qty(2026-11-08 备品口径复核:超出订单数量时也按实际数计入,
        // 不截断 ⇒ 备品转完后本行剩余为负,订单结转页按「剩余>0」过滤自然消失,无需额外改)。
        voucherFlow.linkLine("SO_ORDER", sourceNo, sourceNo + "#" + lineId, str(line.get("存货编码")), qty,
                "PLANG", plNo, plNo + "#" + lineNo, "");
        return plNo;
    }

    /**
     * 工单采用的工艺路线(2026-10-05,用户口径「转工单的时候需要选择工序路线」的兜底口径):
     * 产品档案 {@code bs_inv.工艺路线} 优先 → 未绑定则默认 {@code GY-CB-STD}(炭棒标准路线)。
     */
    public String resolveRoute(String dm) {
        String route = "";
        if (dm != null && !dm.isBlank()) {
            List<String> r = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL([工艺路线],N'') FROM dbo.bs_inv WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    String.class, dm);
            if (!r.isEmpty() && r.get(0) != null) route = r.get(0).trim();
        }
        return route.isEmpty() ? "GY-CB-STD" : route;
    }

    // ────────────────────────── 工具 ──────────────────────────

    /** 订单行剩余可生单数量 = 行数量 − 已占用 */
    private double residual(String sourceNo, String lineId, Map<String, Object> line) {
        Double linked = jdbc.queryForObject(
                "SELECT ISNULL(SUM(ISNULL(linked_quantity,0)),0) FROM form_flow_link"
                        + " WHERE source_panel_code='SO_ORDER' AND source_form_no=? AND source_line_key=? AND link_status='ACTIVE'",
                Double.class, sourceNo, sourceNo + "#" + lineId);
        return qtyOf(line) - (linked == null ? 0 : linked);
    }

    private void requireAudited(String sourceNo) {
        Map<String, Object> st = buttonService.docStatus("SO_ORDER", sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核客户订单可生成生产工单,当前状态:" + status);
    }

    /**
     * 工艺路线必须已审核才能使用(2026-10-16 用户口径)。
     *
     * <p>口径与 {@code bs_route.审核状态} 字段(触发器 {@code trg_yj_doc_status_route_audit}
     * 派生)完全一致：**shr 非空 且 未作废/未中止/非删除申请/非修改中** 才算审核完成。
     * 审批中(pending='Y')不算 —— 那是"还在审",不是"审完"。</p>
     *
     * <p>为什么走 yj_doc_status 而不是读 {@code bs_route.审核状态} 列：那一列是**显示投影**，
     * 依赖触发器是否触发;状态表才是状态机的唯一凭据(与 {@code docStatusOf} 同源)。
     * 取不到状态行 ⇒ 该路线从未走过审核流 ⇒ 视为未审核。</p>
     */
    private void requireRouteAudited(String route) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT shr FROM yj_doc_status WHERE panel_code = 'ROUTE' AND doc_no = ?", route);
        if (rows.isEmpty()) {
            throw new IllegalStateException("工艺路线「" + route + "」尚未审核，不能转工单;"
                    + "请先在 基础设置→工艺路线 对该路线执行「提交审批→审批通过」(或管理员审核)");
        }
        Map<String, Object> st = buttonService.docStatus("ROUTE", route);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) {
            throw new IllegalStateException("工艺路线「" + route + "」" + status + "，不能转工单;"
                    + "请先完成该路线的审核(当前状态:" + status + ")");
        }
    }

    private static double qtyOf(Map<String, Object> line) {
        for (String f : List.of("数量", "订单数量", "需求数量")) {
            Object v = line.get(f);
            if (v == null) continue;
            if (v instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(v).trim()); } catch (NumberFormatException ignore) { }
        }
        return 0;
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static Double num(Object o) {
        if (o == null || String.valueOf(o).isBlank()) return null;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    private static final class Num {
        static double of(Object o) {
            if (o == null) return 0;
            if (o instanceof Number n) return n.doubleValue();
            try { return Double.parseDouble(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
        }
    }
}
