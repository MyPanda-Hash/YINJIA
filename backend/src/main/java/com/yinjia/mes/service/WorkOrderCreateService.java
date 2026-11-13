package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产工单「新增生产工单」(2026-11-13 用户口径)。
 *
 * <p>用户原话:「让当前的生产工单可以新建生产工单」+「在当前新建生产工单中增加一个页签按钮,
 * 为增加临时工单,临时工单需要实现上方为主物料下方为所需的物料根据这个处理实现完成」。
 *
 * <p><b>两种工单的区别(也就是对用户"BOM 会不会查不到"的答复)</b>:
 * <ul>
 *   <li><b>常规工单</b>:只填主物料(产品) —— 用料不在工单上,领料/报工按**产品编码**去
 *       《组装物料清单》{@code bs_asm_bom} 取(现有逻辑不变)⇒ 只要产品维护过标准 BOM,
 *       只填主物料**不会**导致 BOM 查不到;</li>
 *   <li><b>临时工单</b>:主物料 + **子件明细**(按工单定制,落 {@code wo_bom})—— 适用于产品没有
 *       标准 BOM、或用料与标准不同的一次性工单。取数见 {@link WorkOrderBomService}:先本工单行的
 *       wo_bom,没有再回落标准 BOM。</li>
 * </ul>
 *
 * <p><b>不做的事</b>:不写 {@code bd_manu_order}(2026-09-26 数据源单轨:工单=plang);
 * 不写 bd_material_out / 领料单(领料仍走手机扫码「生产领料」或材料出库单面板);
 * 不触发任何报工/检验/入库 —— 新建工单只是"把这一行待生产的活建出来",排在「待排产」池。
 *
 * <p><b>与订单结转共用口径</b>(不另起一套,避免两套规则分叉):
 * <ul>
 *   <li>工艺路线必须**已审核**才可用 ⇒ 直接调 {@link QuickScheduleService#requireRouteAudited}
 *       (与订单结转同一个闸门);</li>
 *   <li>按路线建工序台账 ⇒ {@link ProcessTaskService#ensureLedgerForWorkOrder}(与转单后一致,
 *       否则报工页看不到工序、现场报不了工);</li>
 *   <li>工单号取号 ⇒ {@link FormNoService#next}(GD 段,与转单同号池,不会撞号)。</li>
 * </ul>
 *
 * <p>订单追溯字段 {@code od_no}/{@code od_xc} 手工建单为空(没有销售订单来源);
 * 来源在 {@code bz} 备注里写明「手工新增」/「手工新增·临时工单」,便于与订单结转区分。
 */
@Service
public class WorkOrderCreateService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderCreateService.class);

    /** 工单类型数据键(与前端页签值一一对应;存储口径照用户原话「常规工单/临时工单」) */
    public static final String KIND_NORMAL = "常规";
    public static final String KIND_TEMP = "临时";

    private final JdbcTemplate jdbc;
    private final FormNoService formNo;
    private final ProcessTaskService processTask;
    private final QuickScheduleService quickSchedule;
    private final WorkOrderBomService bomService;

    public WorkOrderCreateService(JdbcTemplate jdbc, FormNoService formNo, ProcessTaskService processTask,
                                  QuickScheduleService quickSchedule, WorkOrderBomService bomService) {
        this.jdbc = jdbc;
        this.formNo = formNo;
        this.processTask = processTask;
        this.quickSchedule = quickSchedule;
        this.bomService = bomService;
    }

    // ────────────────────────── ① 弹窗选项 ──────────────────────────

    /**
     * 「新增生产工单」弹窗的选项:客户列表 + 默认工艺路线。
     *
     * <p>客户数据源 = {@code dm_kh}(客户档案,238 行,量小可以一次下发;前端可搜索)。
     * 默认路线口径:优先炭棒标准路线 {@code GY-CB-STD}(订单结转同款兜底),它若未审核就取第一条
     * 已审核路线;一条都没有则返回空串(前端「工艺路线」为空,保存时后端会拦)。
     */
    public Map<String, Object> options() {
        List<Map<String, Object>> customers = jdbc.queryForList(
                "SELECT dm AS 客户编码, mc AS 客户名称, ISNULL(khjb, N'') AS 客户等级"
                        + " FROM dbo.dm_kh WHERE ISNULL(asp_cancel,'N') <> 'Y'"
                        // 2026-11-13 第二轮:过滤 客户编码/名称为空的行(测试账套里有编码为空的脏行
                        //   「全量流验证」,下拉里会出现「 — 全量流验证」这种无值项;选它等于没选客户)
                        + "   AND ISNULL(mc,N'') <> N'' AND ISNULL(dm,N'') <> N'' ORDER BY dm");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("客户", customers);
        out.put("默认工艺路线", defaultRoute());
        return out;
    }

    /** 默认工艺路线:GY-CB-STD(已审核)优先,否则第一条已审核路线,都没有给空串 */
    private String defaultRoute() {
        List<String> std = jdbc.queryForList(
                "SELECT TOP 1 r.工艺路线编码 FROM dbo.bs_route r"
                        + " JOIN dbo.yj_doc_status s ON s.panel_code = 'ROUTE' AND s.doc_no = r.工艺路线编码"
                        + " WHERE r.工艺路线编码 = N'GY-CB-STD' AND ISNULL(r.asp_cancel,'N') <> 'Y'"
                        + "   AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y'"
                        + "   AND ISNULL(s.stopped,'N') <> 'Y' AND ISNULL(s.deleting,'N') <> 'Y'"
                        + "   AND ISNULL(s.modify_state,N'') NOT IN ('R','Y')", String.class);
        if (!std.isEmpty()) return std.get(0);
        List<String> any = jdbc.queryForList(
                "SELECT TOP 1 r.工艺路线编码 FROM dbo.bs_route r"
                        + " JOIN dbo.yj_doc_status s ON s.panel_code = 'ROUTE' AND s.doc_no = r.工艺路线编码"
                        + " WHERE ISNULL(r.asp_cancel,'N') <> 'Y'"
                        + "   AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N') <> 'Y'"
                        + "   AND ISNULL(s.stopped,'N') <> 'Y' AND ISNULL(s.deleting,'N') <> 'Y'"
                        + "   AND ISNULL(s.modify_state,N'') NOT IN ('R','Y')"
                        + " ORDER BY r.工艺路线编码", String.class);
        return any.isEmpty() ? "" : any.get(0);
    }

    /**
     * 产品(主物料)档案信息:选中产品编码后回填名称/规格/单位/工艺路线。
     *
     * @param productCode 存货编码
     * @throws IllegalArgumentException 编码为空 / 不存在 / 已停用
     */
    public Map<String, Object> productInfo(String productCode) {
        String code = str(productCode);
        if (code.isEmpty()) throw new IllegalArgumentException("请先选择产品编码");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 存货编码, 存货名称, ISNULL(规格型号,N'') AS 规格型号,"
                        + " ISNULL(NULLIF(ISNULL(计量单位,N''),N''), ISNULL(生产单位,N'')) AS 计量单位,"
                        + " ISNULL(工艺路线,N'') AS 工艺路线, ISNULL(所属类别,N'') AS 所属类别,"
                        + " ISNULL(商品标签,N'') AS 商品标签"
                        + " FROM dbo.bs_inv WHERE 存货编码 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", code);
        if (rows.isEmpty()) throw new IllegalArgumentException("产品编码「" + code + "」不存在或已停用,请重新选择");
        return new LinkedHashMap<>(rows.get(0));
    }

    // ────────────────────────── ② 建单 ──────────────────────────

    /**
     * 新建一张生产工单(单行)。
     *
     * @param body {工单类型(常规/临时), 产品编码, 客户编码?, 订单数量, 生产数量?,
     *             工单日期?, 计划开工日期?, 交期?, 工艺路线, 备注?, 物料清单?[{子件编码,子件名称?,
     *             子件规格?,计量单位?,标准用量,损耗量?,行序?,行备注?}]}
     * @param user 当前登录账号(审计 + 取号留痕)
     * @return {工单号, 行id, 工单行号, 工单类型, 物料项数}
     */
    @Transactional
    public Map<String, Object> create(Map<String, Object> body, String user) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String kind = str(b.get("工单类型"));
        if (!KIND_TEMP.equals(kind)) kind = KIND_NORMAL;   // 空/未知一律按常规(前端两页签只会传这两个值)

        // ── 主物料 ──
        String productCode = str(b.get("产品编码"));
        if (productCode.isEmpty()) throw new IllegalArgumentException("请选择主物料(产品编码)");
        Map<String, Object> product = productInfo(productCode);
        String mc = str(product.get("存货名称"));
        String gg = str(product.get("规格型号"));
        String unit = str(product.get("计量单位"));

        // ── 数量(2026-11-13 用户口径第二轮:手工新增没有销售订单,页面**不再填订单数量**)──
        //   · 生产数量 = 唯一必填数量(pl_sl);
        //   · 订单数量 = 可空 —— 旧调用方/草稿历史数据还会带,带了就用;不带则**按生产数量兜底**
        //     (手工单"需求 = 要生产的量",保证列表/排单计划的「需求数量」不为 0;
        //      转换来的工单仍由 QuickScheduleService 写真实订单数量,不受影响);
        //   · 不再要求「订单数量必须大于 0」——那会让没有销售订单的手工单建不出来。
        double planQty = num(b.get("生产数量"));
        if (!(planQty > 0)) planQty = num(b.get("订单数量"));
        if (!(planQty > 0)) throw new IllegalArgumentException("生产数量必须大于 0");
        double orderQty = num(b.get("订单数量"));
        if (!(orderQty > 0)) orderQty = planQty;

        // ── 客户(可空;填了必须存在于客户档案) ──
        String khdm = str(b.get("客户编码"));
        if (!khdm.isEmpty()) {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM dbo.dm_kh WHERE dm = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Integer.class, khdm);
            if (n == null || n == 0) throw new IllegalArgumentException("客户编码「" + khdm + "」不存在,请重新选择");
        } else {
            khdm = null;
        }

        // ── 日期 ──
        Timestamp plDate = dateOf(b.get("工单日期"), "工单日期");
        if (plDate == null) plDate = Timestamp.valueOf(LocalDate.now().atStartOfDay());
        Timestamp stDate = dateOf(b.get("计划开工日期"), "计划开工日期");
        Timestamp cpDate = dateOf(b.get("交期"), "交期");

        // ── 工艺路线(必填,且必须已审核 —— 与订单结转同一道闸门) ──
        String route = str(b.get("工艺路线"));
        if (route.isEmpty()) throw new IllegalArgumentException("请选择工艺路线");
        quickSchedule.requireRouteAudited(route);

        // ── 临时工单必须先有子件明细(这就是它和常规工单的定义性差别) ──
        List<Map<String, Object>> lines = listOf(b.get("物料清单"));
        if (KIND_TEMP.equals(kind) && lines.isEmpty()) {
            throw new IllegalArgumentException("临时工单至少要填写一行所需物料(子件);"
                    + "若只想建常规工单,请切换到「常规工单」页签");
        }

        // ── 落 plang(工单行号=1;od_no/od_xc 为空 = 无销售订单来源) ──
        String plNo = formNo.next("GD", user);
        String memo = str(b.get("备注"));
        if (memo.isEmpty()) memo = KIND_TEMP.equals(kind) ? "手工新增·临时工单" : "手工新增";
        else memo = (KIND_TEMP.equals(kind) ? "手工新增·临时工单:" : "手工新增:") + memo;
        jdbc.update("INSERT INTO dbo.plang (comm, pl_no, pl_xc, pl_date, khdm, dm, mc, gg, jldw,"
                        + " xq_sl, pl_sl, yl, cp_date, st_date, lot_no, od_no, od_xc, ja, asp_cancel,"
                        + " asp_user1, asp_time1, [批次号], [工艺路线], bz)"
                        + " VALUES (N'0', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NULL, NULL, N'N', N'N',"
                        + " ?, SYSDATETIME(), NULL, ?, ?)",
                plNo, plDate, khdm, productCode, mc, gg, unit,
                orderQty, planQty, cpDate, stDate, user, route, memo);
        Long rowId = jdbc.queryForObject(
                "SELECT TOP 1 id FROM dbo.plang WHERE pl_no = ? AND pl_xc = 1"
                        + " AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC", Long.class, plNo);
        if (rowId == null) throw new IllegalStateException("工单已建但取行id失败,请刷新列表核对:" + plNo);

        // ── 临时工单:子件明细写 wo_bom(按工单行定制,不碰产品标准 BOM) ──
        int linesWritten = 0;
        if (KIND_TEMP.equals(kind)) {
            linesWritten = insertBomLines(plNo, rowId, productCode, lines, user);
        }

        // ── 工序台账(与订单结转同口径;失败不阻断建单 —— 台账可事后补) ──
        try {
            int n = processTask.ensureLedgerForWorkOrder(plNo, route, user);
            if (n > 0) log.info("[新增生产工单] {} 按路线 {} 建工序台账 {} 道", plNo, route, n);
        } catch (Exception e) {
            log.warn("[新增生产工单] {} 建工序台账失败(不阻断建单): {}", plNo, e.getMessage());
        }

        log.info("[新增生产工单] {} {} 产品={} 订单数量={} 生产数量={} 路线={} 子件{}行 by {}",
                plNo, kind, productCode, orderQty, planQty, route, linesWritten, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单号", plNo);
        out.put("行id", rowId);
        out.put("工单行号", 1);
        out.put("工单类型", kind);
        out.put("物料项数", linesWritten);
        return out;
    }

    /**
     * 写临时工单用料(wo_bom)。
     *
     * <p>名称/规格/单位以**存货档案为准**(前端可能只传编码;手填的值只在档案没有时兜底),
     * 避免工单 BOM 与物料档案两处口径打架(2026-10-15 同类事故:参照带回与档案值不一致)。
     *
     * @return 实际写入行数
     */
    private int insertBomLines(String plNo, long rowId, String productCode,
                               List<Map<String, Object>> lines, String user) {
        int seq = 0;
        int written = 0;
        for (Map<String, Object> line : lines) {
            seq++;
            String code = str(line.get("子件编码"));
            if (code.isEmpty()) throw new IllegalArgumentException("第 " + seq + " 行子件编码不能为空");
            List<Map<String, Object>> inv = jdbc.queryForList(
                    "SELECT 存货名称, ISNULL(规格型号,N'') AS 规格型号,"
                            + " ISNULL(NULLIF(ISNULL(计量单位,N''),N''), ISNULL(生产单位,N'')) AS 计量单位"
                            + " FROM dbo.bs_inv WHERE 存货编码 = ? AND ISNULL(asp_cancel,'N') <> 'Y'", code);
            if (inv.isEmpty()) {
                throw new IllegalArgumentException("第 " + seq + " 行子件编码「" + code + "」不存在或已停用,请重新选择");
            }
            Map<String, Object> iv = inv.get(0);
            String name = str(iv.get("存货名称"));
            if (name.isEmpty()) name = str(line.get("子件名称"));
            String spec = str(iv.get("规格型号"));
            if (spec.isEmpty()) spec = str(line.get("子件规格"));
            String unit = str(iv.get("计量单位"));
            if (unit.isEmpty()) unit = str(line.get("计量单位"));
            double qty = num(line.get("标准用量"));
            if (!(qty > 0)) throw new IllegalArgumentException("第 " + seq + " 行(" + code + ")标准用量必须大于 0");
            if (unit.isEmpty()) {
                throw new IllegalArgumentException("第 " + seq + " 行(" + code + ")缺少计量单位,请先在存货档案补单位");
            }
            String lineMemo = str(line.get("行备注"));
            jdbc.update("INSERT INTO dbo.wo_bom (工单号, 工单行id, 工单行号, 产品编码, 行序,"
                            + " 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 损耗量, 行备注, 来源,"
                            + " asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, N'临时工单', ?, SYSDATETIME(), N'N')",
                    plNo, rowId, productCode, seq, code, name, spec, unit,
                    round4(qty), round4(num(line.get("损耗量"))), lineMemo, user);
            written++;
        }
        return written;
    }

    // ────────────────────────── 工具 ──────────────────────────

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOf(Object v) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (v instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) out.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        return out;
    }

    private static Timestamp dateOf(Object v, String label) {
        String s = str(v);
        if (s.isEmpty()) return null;
        String day = s.length() >= 10 ? s.substring(0, 10) : s;
        try {
            return Timestamp.valueOf(LocalDate.parse(day, DateTimeFormatter.ofPattern("yyyy-MM-dd")).atStartOfDay());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(label + "格式应为 yyyy-MM-dd:" + s);
        }
    }

    private static double num(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        String s = str(v);
        if (s.isEmpty()) return 0;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
