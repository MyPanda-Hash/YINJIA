package com.yinjia.mes.panel;

import com.yinjia.mes.service.BatchService;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelConfigService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.QueryService;
import com.yinjia.mes.service.QcCatalogService;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 推式生单(生成XX):来源单整单映射为目标面板草稿,写 form_flow_link 占用,返回 {编号, gotoPanel}
 * 由前端跳转到目标面板继续填写(对齐 PANDA PxService 推式生单语义,复用选单同源映射)。
 *
 * 与选单(拉式)共用 SELECT_FLOWS 链路图与 buildSelectConfig 的头/行映射——同一份映射双向使用。
 * 守护:来源必须「已审核」;该来源→该目标已有 ACTIVE 占用时拒绝重复生单(删除下游草稿自动释放)。
 */
@Component
public class PushGenerateHandler implements PanelActionHandler {

    /** (面板|动作) → 目标面板:与 PanelConfigService.PUSH_TARGETS 同源(按钮生成据此区分可执行/灰占位)。 */
    private String pushTarget(String panelCode, String action) {
        return configService.pushTarget(panelCode, action);
    }

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    private final PanelConfigService configService;
    private final BatchService batchService;
    private final JdbcTemplate jdbc;
    /** 检验目录联动:检验单生成后按明细物料建报告草稿 + 目录行(2026-09-22) */
    private final QcCatalogService qcCatalog;

    public PushGenerateHandler(PanelRegistry registry, QueryService queryService, ButtonService buttonService,
                               VoucherFlowService voucherFlow, PanelConfigService configService,
                               BatchService batchService, JdbcTemplate jdbc, QcCatalogService qcCatalog) {
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.configService = configService;
        this.batchService = batchService;
        this.jdbc = jdbc;
        this.qcCatalog = qcCatalog;
    }

    /** 可分批生单的目标面板:配了「批次号」表头字段(暂收/检验/入库/退回 四张单) */
    private boolean isBatchTarget(String targetPanel) {
        try {
            return registry.panel(targetPanel).fieldsAt("header").stream()
                    .anyMatch(f -> "批次号".equals(f.label()));
        } catch (Exception e) {
            return false;
        }
    }

    /** 已由专用处理器接管的生单动作(仍登记 PUSH_TARGETS 供前端亮钮,但通用映射不认领)。 */
    private static final java.util.Set<String> CUSTOM_OWNED = java.util.Set.of(
            "WO_ORDER|生成领料单",
            // 生产加工单排产:按订单行 1:1 生成(参考库口径),由 ManuScheduleHandler 接管
            "SO_ORDER|生成生产加工单");

    @Override
    public boolean supports(String panelCode, String action) {
        if (CUSTOM_OWNED.contains(panelCode + "|" + action)) return false;
        return pushTarget(panelCode, action) != null;
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        String sourcePanel = context.panelCode();
        String target = pushTarget(sourcePanel, context.action());
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String sourceNo = String.valueOf(noObj);

        // 分批链路(送料暂收单等):直接生成一批 —— 未指定数量时按"剩余量全部送出",批次号自动取号
        if (isBatchTarget(target)) {
            return generateBatch(sourcePanel, target, sourceNo, context.userName(), null);
        }

        // 1) 来源必须已审核(已中止/作废/审批中均不可生单,对齐 T+)
        Map<String, Object> st = buttonService.docStatus(sourcePanel, sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可生单,当前状态:" + status);

        // 2) 该来源→该目标已有占用(选单或生单)时拒绝整单重复生单;删除下游草稿自动释放后可重生
        //    —— 分批链路(目标面板有 批次号)不走这条:采购订单可以分多批送料,改由行级剩余量把关(见 generateBatch)
        if (!isBatchTarget(target)) {
            Integer linked = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code=? AND source_form_no=?"
                            + " AND target_panel_code=? AND link_status='ACTIVE'",
                    Integer.class, sourcePanel, sourceNo, target);
            if (linked != null && linked > 0) {
                throw new IllegalStateException("该单已向目标面板生单(或已选单占用),请先删除下游草稿后重试");
            }
        }

        // 3) 载入来源单(head + 明细,中文标签键)
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        Object detailObj = head.remove("detail");
        List<Map<String, Object>> items = new ArrayList<>();
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) items.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        if (items.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生单");

        // 3b) 行过滤(按生单动作拆行,如 检验单按处置方式拆 入库/退回);过滤后无行则拒绝生单
        String[] filter = configService.detailFilter(sourcePanel, context.action());
        if (filter != null) {
            items = items.stream().filter(it -> {
                Object v = it.get(filter[0]);
                boolean eq = filter[2].equals(v == null ? "" : String.valueOf(v));
                return "=".equals(filter[1]) ? eq : !eq;
            }).collect(java.util.stream.Collectors.toList());
            if (items.isEmpty()) {
                throw new IllegalStateException("无符合生单条件的明细行(过滤:" + filter[0] + filter[1] + filter[2] + ")");
            }
        }

        // 3c) 特采闸门(2026-09-22):来源=来料检验单时,勾了特采的行不得经此路径生成入库/退料
        //     (该路径现为灰色占位,此处为防御性闸门 —— 特采行只能经特采单走,见 ButtonService)
        items = dropSpecialAccept(sourcePanel, items);
        if (items.isEmpty()) throw new IllegalStateException("该检验单的明细行均已勾选特采:特采=让步接收,需先经特采单审批通过(由特采单生成采购入库单)");

        // 4) 头/行映射:与选单共用 buildSelectConfig 生成的 headerMap/detailMap(from=源标签,to=目标标签)
        //    显式传来源(目标面板可有多来源,如 采购入库单 ← 采购订单/来料检验单)
        Map<String, Object> maps = configService.flowMaps(sourcePanel, target);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + target);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put("来源单据", srcDef.name());
        targetHead.put("来源单号", sourceNo);
        // 单据日期=创建当日,不继承来源单日期(2026-09-17 用户口径)。注意:head 键=目标字段标签
        // (save 按标签映射列),而 yj_panel.date_col 是列名(如 QC_RECV 列=单据日期/标签=日期),
        // 故先按列名反查目标字段再用其标签写入;查不到时兜底「单据日期」标签。
        PanelRegistry.PanelDef tgtDef = registry.panel(target);
        String dateLabel = "单据日期";
        if (tgtDef.dateCol() != null && !tgtDef.dateCol().isBlank()) {
            PanelRegistry.FieldDef df = tgtDef.byCol(tgtDef.dateCol());
            if (df != null) dateLabel = df.label();
        }
        targetHead.put(dateLabel, java.time.LocalDate.now().toString());

        List<Map<String, Object>> targetItems = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = item.get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            targetItems.add(row);
            applySourceFlags(sourcePanel, target, item, row);
        }

        // 5) 保存为目标草稿(复用通用保存语义:头行分表/默认值/号池取号)
        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", targetItems));
        Map<String, Object> saved = buttonService.save(registry.panel(target), formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // 5b) 检验目录联动(2026-09-22 用户口径):生成了来料检验单 → 按明细物料建检验数据记录草稿 + 目录行
        if ("QC_INSP".equals(target)) qcCatalog.syncFromInspection(newNo, context.userName());

        // 6) 写占用:来源行不再出现在选单列表(与选单同一占用语义)
        voucherFlow.link(sourcePanel, sourceNo, null, target, newNo, null, 0, "");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", target);
        return out;
    }

    // ==================== 分批送料(P0,2026-09-20) ====================

    /** 数量字段候选(按面板习惯命名,命中即用) */
    private static final List<String> QTY_LABELS = List.of("数量", "实收数量", "送检数量", "计划数量");

    /** 目标面板的"数量"字段标签(无则取第一个候选,兜底「数量」) */
    private String qtyLabelOf(PanelRegistry.PanelDef def, String place) {
        List<String> labels = def.fieldsAt(place).stream().map(PanelRegistry.FieldDef::label).toList();
        for (String c : QTY_LABELS) if (labels.contains(c)) return c;
        return "数量";
    }

    /** 来源行的行号(退货回冲按「采购订单行号」匹配;无则空串) */
    private String lineNoOf(Map<String, Object> item) {
        for (String f : List.of("行号", "采购订单行号", "源单行号")) {
            Object v = item.get(f);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return "";
    }

    /**
     * 采购入库行的两个「来源判定」字段:由**来源单据 / 来源行**带下(2026-09-21、2026-09-23 两次用户口径)。
     * - 是否来料检验:来源 = 来料检验单(QC_INSP):该批物料走过检验 → 是
     *   来源 = 送料暂收单(QC_RECV,暂收后人工判免检直达入库)→ 否
     *   2026-09-22 起采购入库单只有这两个来源(采购订单的免检直达出口已取消),判定无需再改。
     * - 特采(2026-09-23 用户口径「这个字段和来料检验的字段一样,是从来料检验来的」):
     *   取**来源检验行**的「特采」开关 —— 勾了=是,没勾=否;来源行没有该字段(暂收单等)=否。
     *   注意本路径看不见特采数据:勾了特采的检验行已被 {@link #dropSpecialAccept} 闸门排除,
     *   它们的去向是特采单(QC_TC_IN),由 ButtonService.tcInApprovedGenerate 在特采单审批通过时
     *   生成入库单并写 特采=是。此处仍按来源行取值(而不是硬写「否」),闸门口径若变也不会写错。
     * 只对目标面板 = 采购入库单(PURCHASE_IN)生效;目标面板未登记该字段时写入会被通用保存静默忽略。
     */
    private void applySourceFlags(String sourcePanel, String targetPanel,
                                  Map<String, Object> srcItem, Map<String, Object> row) {
        if (!"PURCHASE_IN".equals(targetPanel) || row == null) return;
        row.put("是否来料检验", "QC_INSP".equals(sourcePanel) ? "是" : "否");
        row.put("特采", isSpecialAccept(srcItem) ? "是" : "否");
    }

    private double numOf(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        if (v == null) return 0;
        try { return Double.parseDouble(String.valueOf(v).trim()); } catch (Exception e) { return 0; }
    }

    private double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> itemsOf(Map<String, Object> doc) {
        Object d = doc == null ? null : doc.get("detail");
        if (d instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object o : l) if (o instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
            return out;
        }
        return List.of();
    }

    /**
     * 分批送料对话框的行状态:每行 订单量 / 已送 / 已退回(回冲) / 剩余 / 可送上限,
     * 并附 该订单已有批次清单(含"待编号"批次)。前端「生成送料暂收单」据此弹出分批对话框。
     * 注:2026-09-21 二次口径 —— 批次号 = 采购入库单「单据日期」(纯 yyyyMMdd,同一日期同一批次),
     * 填单时预设、可人工改,审核时确认并回填;生单这一跳(暂收/检验)不做预告,故不返回"下一批次号"。
     */
    /** 检验行的「特采」标志为真(bit/Boolean/是/true/1 均认) */
    private static boolean isSpecialAccept(Map<String, Object> item) {
        Object v = item == null ? null : item.get("特采");
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.doubleValue() != 0d;
        String s = String.valueOf(v).trim();
        return "true".equalsIgnoreCase(s) || "是".equals(s) || "1".equals(s);
    }

    /** 超送比例上限(2026-09-22 用户口径):**最高 50%** —— 弹窗覆盖与系统参数一律钳在 0~0.5 */
    private static final double MAX_OVER_RATIO = 0.5d;

    /**
     * 行的「可送上限」(2026-09-22 口径:**按全部数量算**)—— 订单数量×(1+超送比例) − 已送 + 已退回,负数归 0。
     * 旧口径 剩余×(1+比例) 的问题:每批只给"当批剩余"的比例额,分批越多超送额度越算越少,
     * 累计超送永远到不了订单总量的比例额;正确语义是"整张订单行**累计**最多收 数量×(1+比例)"。
     * 前端同公式:core/selection/batchSendLines.js 的 overAllowance(纯函数,有单测)。
     */
    private static double overAllowance(double orderQty, double sent, double returned, double ratio) {
        double r = Math.max(0d, Math.min(MAX_OVER_RATIO, ratio));
        double v = orderQty * (1 + r) - sent + returned;
        return v > 0 ? v : 0d;
    }

    /**
     * 特采闸门(2026-09-22):来源=来料检验单(QC_INSP)时,勾了「特采」的明细行**不得**经
     * 选单/推式路径直接生成 采购入库单/暂收退回单 —— 它们的去向是特采单,特采单审核通过后
     * 由 ButtonService.tcInApprovedGenerate 整行(合格+不合格)生成入库单(不走退料)。
     */
    private static List<Map<String, Object>> dropSpecialAccept(String sourcePanel, List<Map<String, Object>> items) {
        if (!"QC_INSP".equals(sourcePanel)) return items;
        return items.stream().filter(it -> !isSpecialAccept(it)).collect(java.util.stream.Collectors.toList());
    }

    public Map<String, Object> batchLines(String sourcePanel, String targetPanel, String sourceNo) {
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, sourceNo);
        Map<String, Double> returned = batchService.returnedByOrderLine(sourceNo);
        double ratio = batchService.overRatio();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> it : itemsOf(src)) {
            // 特采行(2026-09-22 闸门):不进选单/生单列表 —— 剩余量已被 QC_INSP→QC_TC_IN 占用吃掉,
            // 这里再显式排除一道,保证特采行在任何手工路径都不可见
            if ("QC_INSP".equals(sourcePanel) && isSpecialAccept(it)) continue;
            Object id = it.get("id");
            String lineKey = sourceNo + "#" + (id == null ? "" : String.valueOf(id));
            double qty = numOf(it.get("数量"));
            double used = sent.getOrDefault(lineKey, 0d);
            double ret = returned.getOrDefault(lineNoOf(it), 0d);
            double left = Math.max(0, qty - used + ret);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("lineKey", lineKey);
            row.put("id", id);
            row.put("行号", it.get("行号"));
            row.put("物料编码", it.get("物料编码"));
            row.put("物料名称", it.get("物料名称"));
            row.put("规格型号", it.get("规格型号"));
            row.put("计量单位", it.get("计量单位") != null ? it.get("计量单位") : it.get("单位"));
            row.put("数量", round2(qty));
            row.put("已送数量", round2(used));
            row.put("已退回数量", round2(ret));
            row.put("剩余数量", round2(left));
            // 可送上限(2026-09-22 口径):按**订单全部数量**算,不再用 剩余×(1+比例)
            row.put("可送上限", round2(overAllowance(qty, used, ret, ratio)));
            rows.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sourcePanel", sourcePanel);
        out.put("sourceNo", sourceNo);
        out.put("targetPanel", targetPanel);
        out.put("overRatio", ratio);
        out.put("batches", batchService.batches(sourcePanel, sourceNo)); // 有效批次(ACTIVE 已编号 + PENDING 待编号)
        out.put("lines", rows);
        return out;
    }

    /**
     * 分批生单:按行指定「本次送料量」生成一张目标草稿(送料暂收单),写**待编号**批次台账 + 按量占用。
     * - qtyByLineKey 为空 = 所有"还有剩余"的行按剩余量全部送出(推式按钮直接点、或选单一次性送完);
     * - 校验:来源已审核 / 目标为分批面板 / 每行 0 < 本次 ≤ 可送上限(= 订单数量×(1+超送比例)−已送+已退回,
     *   **按全部数量算**,2026-09-22 口径;超送比例最高 50%) / 至少一行;
     * - **暂收单批次号留空**(2026-09-21 二次口径):本跳只登记一行 status='PENDING'、batch_no=NULL 的台账
     *   (create_time=送料当天),把该行 id 作「批次键」逐站带下去;批次号到**采购入库单**填单时预设
     *   (=入库单「单据日期」,前端 docDefaults)并可人工改,审核时由 BatchService.assignNoAndBackfill 确认并回填全链;
     * - 失败回滚:台账行随 @Transactional 一并回滚,不再有"回收序号"一说(@Transactional)。
     */
    @Transactional
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey) {
        return generateBatch(sourcePanel, targetPanel, sourceNo, user, qtyByLineKey, null);
    }

    /**
     * 分批生单(带超送比例覆盖):overRatioOverride 非空时按本次指定比例校验上限(界面弹窗可调),
     * 为空则用系统参数 `receive_over_ratio`。比例夹在 0~**0.5**(0=不允许超送;2026-09-22 用户口径:
     * 超送最高 50%)。上限按**订单全部数量**算:数量×(1+比例)−已送+已退回(见 overAllowance)。
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey, Double overRatioOverride) {
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        PanelRegistry.PanelDef tgtDef = registry.panel(targetPanel);
        if (!isBatchTarget(targetPanel)) throw new IllegalStateException("目标面板未启用分批送料:" + targetPanel);

        // 1) 来源必须已审核
        Map<String, Object> st = buttonService.docStatus(sourcePanel, sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可生单,当前状态:" + status);

        // 2) 载入来源单(头 + 行)
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        head.remove("detail");
        List<Map<String, Object>> srcItems = new ArrayList<>(itemsOf(src));
        if (srcItems.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生单");

        // 3) 行级剩余量核算(含退货回冲) + 本次送料量校验
        Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, sourceNo);
        Map<String, Double> returned = batchService.returnedByOrderLine(sourceNo);
        // 超送比例:弹窗可临时覆盖(夹 0~**0.5**,2026-09-22 用户口径:超送最高 50%),
        // 未给则用系统参数 receive_over_ratio(BatchService.overRatio 同样钳 0~0.5)
        double ratio = overRatioOverride == null ? batchService.overRatio()
                : Math.max(0d, Math.min(MAX_OVER_RATIO, overRatioOverride));
        List<Map<String, Object>> picked = new ArrayList<>();   // {item, qty}
        for (Map<String, Object> it : srcItems) {
            // 特采行(2026-09-22 闸门):不得经此路径生成入库/退料 —— 走特采单(审核后整行入库)
            if ("QC_INSP".equals(sourcePanel) && isSpecialAccept(it)) continue;
            String lineKey = sourceNo + "#" + it.get("id");
            double orderQty = numOf(it.get("数量"));
            double used = sent.getOrDefault(lineKey, 0d);
            double ret = returned.getOrDefault(lineNoOf(it), 0d);
            double left = Math.max(0, orderQty - used + ret);
            // 可送上限(2026-09-22 口径):**按订单全部数量算** = 数量×(1+比例)−已送+已退回 ——
            // 已送满订单(剩余=0)的行仍可收 订单数量×比例 的超送额度;默认整送=剩余(不主动超送),
            // 只有"累计到顶后还显式要送"才报具体的上限(而不是笼统的"已无剩余可送")
            double cap = overAllowance(orderQty, used, ret, ratio);
            double qty = qtyByLineKey == null ? left : qtyByLineKey.getOrDefault(lineKey, 0d);
            if (qty <= 0.000001) continue;                       // 本次不送
            if (qty > cap + 0.000001) {
                throw new IllegalStateException("第 " + it.get("行号") + " 行本次送料量 " + round2(qty)
                        + " 超出允许上限 " + round2(cap) + "(订单数量 " + round2(orderQty) + " ×(1 + 超送比例 "
                        + Math.round(ratio * 100) + "%)− 已送 " + round2(used) + " + 已退回 " + round2(ret) + ")");
            }
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("item", it);
            p.put("qty", qty);
            picked.add(p);
        }
        if (picked.isEmpty()) {
            boolean allSpecial = "QC_INSP".equals(sourcePanel) && !srcItems.isEmpty()
                    && srcItems.stream().allMatch(PushGenerateHandler::isSpecialAccept);
            throw new IllegalStateException(allSpecial
                    ? "该检验单的明细行均已勾选特采:特采=让步接收,需先经特采单审批通过(由特采单生成采购入库单,不走此路径)"
                    : "该单据已无剩余可送(各明细行均已送满)");
        }

        // 4) 头/行映射(与选单共用 buildSelectConfig),再覆盖 本次数量 + 批次键
        Map<String, Object> maps = configService.flowMaps(sourcePanel, targetPanel);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + targetPanel);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");
        String tgtQtyLabel = qtyLabelOf(tgtDef, "detail");

        // 批次键来源(2026-09-21):**来源单已带「批次键」时继承,不再新登记台账** ——
        // 键在「采购订单→送料暂收单」这一跳产生(该跳台账行属那张采购订单),下游(暂收→检验→入库/退回)
        // 一律继承同一个键;本跳目标(暂收/检验/退料)的批次号**留空** —— 采购入库单的号在填单时预设
        // (=入库单「单据日期」,前端 docDefaults)、可人工改,审核时由 BatchService.assignNoAndBackfill
        // 确认后再顺键回填全链(否则每跳都会给上游单再发一个批次键,批次追溯断链)。
        Object srcKeyObj = head.get("批次键");
        Integer inheritKey = srcKeyObj instanceof Number n ? n.intValue()
                : (srcKeyObj == null || String.valueOf(srcKeyObj).isBlank() ? null
                : Integer.valueOf(String.valueOf(srcKeyObj).trim()));
        int batchId = inheritKey != null ? inheritKey
                : batchService.createPending(sourcePanel, sourceNo, targetPanel, user);

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put("来源单据", srcDef.name());
        targetHead.put("来源单号", sourceNo);
        targetHead.put("批次键", batchId);      // 链路键:审核时顺它回填(目标面板未登记该字段时被通用保存忽略)
        targetHead.remove("批次号");            // 本跳(暂收/检验/退料)批次号留空;入库单的号在填单时预设、审核时确认
        String dateLabel = "单据日期";
        if (tgtDef.dateCol() != null && !tgtDef.dateCol().isBlank()) {
            PanelRegistry.FieldDef df = tgtDef.byCol(tgtDef.dateCol());
            if (df != null) dateLabel = df.label();
        }
        targetHead.put(dateLabel, java.time.LocalDate.now().toString());

        List<Map<String, Object>> targetItems = new ArrayList<>();
        for (Map<String, Object> p : picked) {
            Map<String, Object> item = (Map<String, Object>) p.get("item");
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = item.get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            row.put(tgtQtyLabel, p.get("qty"));   // 本次送料数量
            row.remove("批次号");                  // 行批次号同样留空(入库审核确认批次号时按批次键回填)
            applySourceFlags(sourcePanel, targetPanel, item, row);
            targetItems.add(row);
        }

        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", targetItems));
        Map<String, Object> saved = buttonService.save(tgtDef, formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // 4b) 检验目录联动(2026-09-22 用户口径):分批生单目标=来料检验单时同样建报告草稿 + 目录行
        if ("QC_INSP".equals(targetPanel)) qcCatalog.syncFromInspection(newNo, user);

        // 5) 按量占用(带批次键):目标行按保存顺序取行表 id
        List<Integer> tgtIds = jdbc.queryForList("SELECT id FROM " + tgtDef.lineTable()
                        + " WHERE [" + tgtDef.groupCol() + "] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id",
                Integer.class, newNo);
        List<VoucherFlowService.BatchLine> links = new ArrayList<>();
        double sum = 0;
        for (int i = 0; i < picked.size(); i++) {
            Map<String, Object> item = (Map<String, Object>) picked.get(i).get("item");
            double qty = (double) picked.get(i).get("qty");
            sum += qty;
            links.add(new VoucherFlowService.BatchLine(
                    sourceNo + "#" + item.get("id"),
                    i < tgtIds.size() ? newNo + "#" + tgtIds.get(i) : null,
                    item.get("物料编码") == null ? null : String.valueOf(item.get("物料编码")),
                    numOf(item.get("数量")), qty));
        }
        voucherFlow.linkBatch(sourcePanel, sourceNo, targetPanel, newNo, null, batchId, links);
        if (inheritKey == null) batchService.bind(batchId, targetPanel, newNo, round2(sum)); // 继承批次键时不改台账(归订单那一跳)

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("批次号", "");                  // 本跳不预告批次号(入库单填单时按单据日期预设)
        out.put("批次键", batchId);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", targetPanel);
        out.put("本次送料合计", round2(sum));
        return out;
    }
}
