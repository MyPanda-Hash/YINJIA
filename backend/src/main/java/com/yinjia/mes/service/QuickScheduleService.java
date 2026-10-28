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

    /** 整单按行生成工单草稿(增量:剩余为 0 的行跳过),返回新单号;支持同一行反复点击多次生成 */
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
     * 单行 → plang 工单行(2026-09-27 定稿 + 批次号终版:每次转单各自成批):
     * **同一销售订单共用一张工单**(pl_no 沿用该订单首次转单号,首次取新 MO 号);
     * **工单行号 pl_xc = 销售订单明细行的行号**(bl_so_order.行号,金蝶分录 seq 从 1 连续);
     * **批次号 = 转单日期 yyyyMMdd,同一天多次转单各自成批依次 -2/-3 后缀**(每日重新起算;
     * 首转=纯日期,再转=日期-2、日期-3…)——不再累加,每次转单=一条新批次行。
     * 来源订单行以 od_no/od_xc 回链;占用通道 target_panel_code='PLANG'。
     * 严格「已审核」闸门;剩余=行数量−各通道占用;qtyOverride 空=剩余全部。
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
        if (residual <= 0.0001) {
            throw new IllegalStateException("该订单行已全部转出(剩余可转数量 0)");
        }
        double qty = qtyOverride != null && qtyOverride > 0 ? Math.min(qtyOverride, residual) : residual;
        if (qty <= 0) throw new IllegalStateException("生单数量必须大于 0");
        if (qty > residual + 0.0001) throw new IllegalStateException("生单数量 " + qty + " 超过剩余可转数量 " + residual);
        // 工单号+工单行号确定唯一工单行;生产批次号不在转单时生成。
        // 批次号是完工后的日期属性,不能作为 plang 行身份;身份始终是 plang.id。
        String plNo;
        try {
            plNo = jdbc.queryForObject(
                    "SELECT TOP 1 pl_no FROM plang WHERE od_no = ? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY pl_xc DESC",
                    String.class, sourceNo);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            plNo = null;   // 该订单尚未转过工单 → 取新号
        }
        // 生产工单前缀 MO → GD(2026-10-05 用户口径「修改生产工单」):只影响新单号,历史单号不变;
        // 取号流水在 s_allno(按 前缀+年月 独立序列),不与旧前缀混号。
        boolean reuseNo = plNo != null && !plNo.isBlank();
        if (!reuseNo) plNo = formNo.next("GD", user);
        Integer lineNo = line.get("行号") instanceof Number n ? n.intValue() : 1;
        // 🔴 2026-10-19 修(用户报障「号池又错了 —— 转出来的工单和已有单撞号」):
        //   **同一张销售订单的第二行**转工单时,上面按 od_no 复用了工单号(设计如此:一张订单一个工单号),
        //   但行号仍取**订单行自己的 行号** —— 而 bl_so_order.行号 实测存在重复(两行都是 1),
        //   于是插出一条 (工单号, 行号) 完全相同的行(实测 GD-2026-10-0023 出现两条 #1,
        //   一条来自 LZW-20261016-01 行 9724、一条来自行 9727,客户/物料/数量都一样)。
        //   修法:复用已有工单号时,**行号一律取该工单号下的 MAX(pl_xc)+1**(物理上不可能再撞)。
        if (reuseNo) {
            Integer maxXc = jdbc.queryForObject(
                    "SELECT ISNULL(MAX(ISNULL(pl_xc,0)),0) FROM dbo.plang WHERE pl_no=?", Integer.class, plNo);
            lineNo = (maxXc == null ? 0 : maxXc) + 1;
        }
        String batch = null; // 生产批次在工单行首次生产完工时生成
        String due = str(line.get("交货日期"));
        // 余量口径(2026-09-27 用户拍板):余量=需求数量−排产数量(未排产),不再是排产数量
        double remain = demand - qty;
        jdbc.update("INSERT INTO plang (comm, pl_no, pl_xc, pl_date, khdm, dm, mc, gg, jldw,"
                        + " xq_sl, pl_sl, yl, cp_date, lot_no, od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1, [批次号], [工艺路线])"
                        + " VALUES (N'0', ?, ?, GETDATE(), ?, ?, ?, ?, ?, ?, ?, ?,"
                        + " CASE WHEN ? IS NULL OR ? = N'' THEN NULL ELSE CONVERT(datetime, ?, 120) END,"
                        + " ?, ?, CONVERT(float, ?), 'N', 'N', ?, GETDATE(), ?, ?)",
                plNo, lineNo, str(line.get("客户编码")), str(line.get("存货编码")), str(line.get("存货名称")),
                str(line.get("规格型号")), str(line.get("销售单位")), demand, qty, remain, due, due, due,
                null, sourceNo, Integer.parseInt(lineId), user, null,
                // 工单关联工艺路线(2026-10-05):**用订单结转所选,不兜底默认**(用户口径「不需要实现默认选择」);
                // 未选 = NULL,后续不推导"下一道工序",由经办人补选后再排产
                (route != null && !route.isBlank()) ? route.trim() : null);
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
