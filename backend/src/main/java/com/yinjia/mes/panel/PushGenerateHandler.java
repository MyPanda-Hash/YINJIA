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
    /** 材料码打印预约(采购订单自行打码场景):余量扣减与「已打印待生单」取数 */
    private final com.yinjia.mes.service.PuLabelService puLabel;
    /** 检验目录联动:检验单生成后按明细物料建报告草稿 + 目录行(2026-09-22) */
    private final QcCatalogService qcCatalog;

    public PushGenerateHandler(PanelRegistry registry, QueryService queryService, ButtonService buttonService,
                               VoucherFlowService voucherFlow, PanelConfigService configService,
                               BatchService batchService, JdbcTemplate jdbc, QcCatalogService qcCatalog,
                               com.yinjia.mes.service.PuLabelService puLabel) {
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.configService = configService;
        this.batchService = batchService;
        this.jdbc = jdbc;
        this.qcCatalog = qcCatalog;
        this.puLabel = puLabel;
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
            // 生产工单生单:按订单行 1:1 生成(参考库口径),由 ManuScheduleHandler 接管
            "SO_ORDER|生成生产工单");

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

        // 3c) 特采闸门已拆除(2026-10-04 口径):检验明细的「特采」字段整体下线,特采改由
        //     「暂收退料单审批通过 → 特采按钮 → 特采单 → 采购入库单」表达。检验行的合格/不良
        //     照常分流(合格→采购入库、不良→暂收退料单),此路径不再需要按行排除任何东西。

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
     * - 特采(2026-10-04 口径变更):**本路径恒为「否」**。检验明细的「特采」字段已整体下线,
     *   特采改由「暂收退料单审批通过 → 特采按钮 → 特采单 → 采购入库单」表达,那条链上的入库行
     *   由 ButtonService.tcInApprovedGenerate 硬写「是」。本路径(选单/推式)永远产的是普通入库行。
     * 只对目标面板 = 采购入库单(PURCHASE_IN)生效;目标面板未登记该字段时写入会被通用保存静默忽略。
     */
    private void applySourceFlags(String sourcePanel, String targetPanel,
                                  Map<String, Object> srcItem, Map<String, Object> row) {
        if (!"PURCHASE_IN".equals(targetPanel) || row == null) return;
        row.put("是否来料检验", "QC_INSP".equals(sourcePanel) ? "是" : "否");
        row.put("特采", "否");
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
     * 并附 该订单已有批次清单(含历史"待编号"批次)与**本次将写入的批次号**。
     * 2026-10-04 口径:批次号在**生单那一刻**定稿(供应商编码去 YJ- 前缀 + - + 当天 yyyyMMdd),
     * 故这里能预告 —— 来源单已有号时用它的,否则按同一公式现算(与 generateBatch 完全同源,
     * 前端据此在弹窗里显示"本批批次号",不必等生单完再看)。
     */
    /**
     * 隔离行的行键定式:`{采购订单号}#{采购订单行id}@{材料码打印行id}`(2026-10-04)。
     *
     * <p><b>为什么隔离行要有自己的 lineKey</b>:打印出去的那部分量**从原行数量里切走**独立成行后,
     * 它自己的"送了多少"必须与原行的"送了多少"**各记各的** —— 而送料量是靠
     * {@code form_flow_link.source_line_key} 记的。若两行共用同一个键,就分不清
     * "这批货是从已打印的那部分送的"还是"从原行送的":用同一个批次号混单时,
     * 已生单量会把两部分加在一起,打印行的"已生单"就虚高。
     * 给隔离行一个专属键 ⇒ 计数天然准确,而且**下游单作废/删除时 link 置 RELEASED,
     * 该行的已生单量自动回落**(零回滚代码,见 PuLabelService 的派生口径)。
     */
    private static String isolatedLineKey(String orderLineKey, Object labelRowId) {
        return orderLineKey + "@" + (labelRowId == null ? "" : String.valueOf(labelRowId));
    }

    /** 行键是不是隔离行(含 `@`);隔离行只能经"已打印"那条道生单 */
    private static boolean isIsolatedKey(String lineKey) {
        return lineKey != null && lineKey.indexOf('@') > 0;
    }

    /** 从隔离行键还原出所属订单行的键(去掉 `@...`) */
    private static String orderKeyOf(String lineKey) {
        int i = lineKey == null ? -1 : lineKey.indexOf('@');
        return i < 0 ? lineKey : lineKey.substring(0, i);
    }

    /**
     * 生单候选行(**batchLines 与 generateBatch 共用同一份口径**,避免两处各算一套而漂移):
     * <ol>
     *   <li><b>订单行</b>:`数量` = 订单数量 − Σ 该行存活打印记录的打印数量(2026-10-04 用户口径
     *       「打印后的那一行是已经从原来数量隔离出来的」),已送/已退回/剩余/可送上限都按这个扣后数量算
     *       (超送额度也随之按扣后数量算);</li>
     *   <li><b>隔离行</b>:每个「存活且未送完」的打印记录一行,行号/物料与原行相同,
     *       `数量` = 打印数量、`已送数量` = 已生单量、`剩余数量` = 未生单量,`批次号` = 材料码上的号;
     *       已生单的行(未生单 = 0)**仍在列表里**但只剩一个"已生单"标记,不可再勾(用户口径)。</li>
     * </ol>
     * 两类行的已送量**各记各的**:订单行只认自己那个 lineKey 的 link,隔离行只能认自己专属 lineKey 的
     * link(见 {@link #isolatedLineKey})。
     */
    private List<Map<String, Object>> batchRows(String sourcePanel, String sourceNo,
                                                List<Map<String, Object>> srcItems,
                                                Map<String, Double> sent, Map<String, Double> returned,
                                                double ratio) {
        // 材料码打印记录(只有采购订单这条链有;其余来源面板为空)
        List<Map<String, Object>> labels = "PU_ORDER".equals(sourcePanel) ? puLabel.labelRows(sourceNo) : List.of();
        Map<Integer, List<Map<String, Object>>> byLine = new LinkedHashMap<>();
        for (Map<String, Object> lb : labels) {
            byLine.computeIfAbsent(intOf(lb.get("采购订单行id")), k -> new ArrayList<>()).add(lb);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> it : srcItems) {
            Object id = it.get("id");
            int lineId = intOf(id);
            String orderKey = sourceNo + "#" + (id == null ? "" : String.valueOf(id));
            List<Map<String, Object>> mine = byLine.getOrDefault(lineId, List.of());
            double printed = 0d;
            for (Map<String, Object> lb : mine) printed += numOf(lb.get("打印数量"));
            printed = round2(printed);
            double orderQty = numOf(it.get("数量"));
            double carved = Math.max(0d, orderQty - printed);     // ★ 切走打印量后的"原行数量"
            double used = sent.getOrDefault(orderKey, 0d);        // 只认订单行自己的 link(隔离行的键不同)
            double ret = returned.getOrDefault(lineNoOf(it), 0d);

            Map<String, Object> row = baseRow(it, orderKey, id);
            row.put("rowKind", "order");
            row.put("订单数量", round2(orderQty));
            row.put("已打印数量", printed);
            row.put("数量", round2(carved));
            row.put("已送数量", round2(used));
            row.put("已退回数量", round2(ret));
            row.put("剩余数量", round2(Math.max(0d, carved - used + ret)));
            row.put("可送上限", round2(BatchService.overAllowance(carved, used, ret, ratio)));
            rows.add(row);

            // 隔离行:每个存活打印记录一行(含已生单的,便于用户看见"这批已经用过了")
            for (Map<String, Object> lb : mine) {
                String isoKey = isolatedLineKey(orderKey, lb.get("行id"));
                double pQty = numOf(lb.get("打印数量"));
                double gen = sent.getOrDefault(isoKey, 0d);
                double pending = Math.max(0d, pQty - gen);
                Map<String, Object> ir = baseRow(it, isoKey, id);
                ir.put("rowKind", "printed");
                ir.put("订单数量", round2(orderQty));
                ir.put("已打印数量", round2(pQty));
                ir.put("数量", round2(pQty));
                ir.put("已送数量", round2(gen));           // 隔离行的"已送" = 已生单量
                ir.put("已退回数量", 0d);
                ir.put("剩余数量", round2(pending));        // 未生单量;0 ⇒ 已生单(不可再勾)
                ir.put("可送上限", round2(pending));
                ir.put("批次号", lb.get("批次号"));
                ir.put("打印单号", lb.get("单据编号"));
                ir.put("打印时间", lb.get("打印时间"));
                ir.put("已生单", pending <= 0.000001);
                rows.add(ir);
            }
        }
        return rows;
    }

    /** 行骨架(两类行共用的展示字段) */
    private Map<String, Object> baseRow(Map<String, Object> it, String lineKey, Object id) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("lineKey", lineKey);
        row.put("id", id);
        row.put("行号", it.get("行号"));
        row.put("物料编码", it.get("物料编码"));
        row.put("物料名称", it.get("物料名称"));
        row.put("规格型号", it.get("规格型号"));
        row.put("计量单位", it.get("计量单位") != null ? it.get("计量单位") : it.get("单位"));
        return row;
    }

    /**
     * 按行键取来源明细:行键 = `{来源单号}#{来源行id}`(或隔离行 `...#{行id}@{打印行id}`),
     * 一律按最后一个 `#` 后面的行 id 命中(来源单号里也可能含 `#`,故取 lastIndexOf)。
     */
    private static Map<String, Object> sourceItemOf(List<Map<String, Object>> srcItems, String orderLineKey) {
        int hash = orderLineKey == null ? -1 : orderLineKey.lastIndexOf('#');
        if (hash < 0) return null;
        int want = intOf(orderLineKey.substring(hash + 1));
        for (Map<String, Object> it : srcItems) if (intOf(it.get("id")) == want) return it;
        return null;
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o == null || String.valueOf(o).trim().isEmpty()) return 0;
        try { return (int) Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }

    public Map<String, Object> batchLines(String sourcePanel, String targetPanel, String sourceNo) {
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, sourceNo);
        Map<String, Double> returned = batchService.returnedByOrderLine(sourceNo);
        double ratio = batchService.overRatio();
        List<Map<String, Object>> rows = batchRows(sourcePanel, sourceNo, itemsOf(src), sent, returned, ratio);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sourcePanel", sourcePanel);
        out.put("sourceNo", sourceNo);
        out.put("targetPanel", targetPanel);
        out.put("overRatio", ratio);
        // 本批批次号(生单即定号;与 generateBatch 同一公式 —— 来源单已有号则继承)
        String srcBatch = str(src.get("批次号"));
        out.put("nextBatchNo", srcBatch.isEmpty()
                ? BatchService.buildBatchNo(supplierCodeOf(src, Map.of()), java.time.LocalDate.now())
                : srcBatch);
        out.put("batches", batchService.batches(sourcePanel, sourceNo)); // 有效批次(ACTIVE 已编号 + 历史 PENDING)
        out.put("lines", rows);
        return out;
    }

    /**
     * 分批生单:按行指定「本次送料量」生成一张目标草稿(目标为分批链路面板),写批次台账 + 按量占用。
     * - qtyByLineKey 为空 = 所有"还有剩余"的行按剩余量全部送出(推式按钮直接点、或选单一次性送完);
     * - 校验:来源已审核 / 目标为分批面板 / 每行 0 < 本次 ≤ 可送上限(= 订单数量×(1+超送比例)−已送+已退回,
     *   **按全部数量算**,2026-09-22 口径;超送比例最高 50%) / 至少一行;
     * - **批次号在生单这一刻就写**(2026-10-04 用户口径,取代"入库审核取号 + 回填全链"):
     *   链路头一跳(采购订单→送料暂收单)= 按「供应商编码去掉 YJ- 前缀 + - + 当天 yyyyMMdd」取号
     *   (如 YJ-TX、2026-09-10 ⇒ TX-20260910,见 BatchService.buildBatchNo);
     *   **这一跳允许在生单对话框里人工改号**(batchNoOverride,用户口径「在生单时批次号就可以修改」);
     *   下游各跳(暂收→检验、暂收/检验→入库、检验→退回)= **继承来源单头上的号**,不重新取号、
     *   也不接受覆盖(继承优先,避免下游把上游的号改飘);
     *   单头与**全部明细行**写同一个号(头行一致,下游单据元数据里明细列已置只读);
     * - 失败回滚:台账行随 @Transactional 一并回滚,不再有"回收序号"一说(@Transactional)。
     */
    @Transactional
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey) {
        return generateBatch(sourcePanel, targetPanel, sourceNo, user, qtyByLineKey, null, null);
    }

    /**
     * 分批生单(带超送比例覆盖):overRatioOverride 非空时按本次指定比例校验上限(界面弹窗可调),
     * 为空则用系统参数 `receive_over_ratio`。比例夹在 0~**0.5**(0=不允许超送;2026-09-22 用户口径:
     * 超送最高 50%)。上限按**订单全部数量**算:数量×(1+比例)−已送+已退回(见 overAllowance)。
     */
    @Transactional
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey, Double overRatioOverride) {
        return generateBatch(sourcePanel, targetPanel, sourceNo, user, qtyByLineKey, overRatioOverride, null);
    }

    /** 批次号列宽(与 sl_recv/qc_insp/qc_return/bd_purchase_in 的 nvarchar(100) 对齐;超长会在落库时截断报错,故先拦) */
    private static final int BATCH_NO_MAX = 100;

    /**
     * 分批生单(带**批次号覆盖**):batchNoOverride = 生单对话框里人工填/改的批次号(可空)。
     * 只在**链路头一跳**(来源单头上还没有号 = 本跳负责取号)生效 —— 用户口径
     * 「在生单时批次号就可以修改」:对话框里的输入框默认按公式预填,想改就改,确定后按这个号落库;
     * 留空则仍按公式取号。下游各跳一律继承来源单的号,传进来的覆盖值**忽略**(见调用点注释)。
     * 空串/纯空白视为"没改";超长(> {@value #BATCH_NO_MAX})直接拒绝,免得写到库里被静默截断。
     *
     * <p>材料码隔离行(2026-10-04)**不需要**额外参数:它们的行键自带身份
     * ({@code ...#{行id}@{打印行id}}),批次号直接取自那一行({@link #batchRows} 给出的
     * 「批次号」),生单时以它为准 —— 少一个入参就少一处可能对不上的口径。
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey,
                                             Double overRatioOverride, String batchNoOverride) {
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
        //    候选行 = 订单行(数量已切掉打印量) + 各已打印批次的**隔离行** —— 与 batchLines 共用 batchRows,
        //    保证"弹窗看到的"与"生单校验用的"永远是同一份口径(两处各算一套迟早对不上)。
        Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, sourceNo);
        Map<String, Double> returned = batchService.returnedByOrderLine(sourceNo);
        // 超送比例:弹窗可临时覆盖(夹 0~**0.5**,2026-09-22 用户口径:超送最高 50%),
        // 未给则用系统参数 receive_over_ratio(BatchService.overRatio 同样钳 0~0.5)
        double ratio = overRatioOverride == null ? batchService.overRatio()
                : Math.max(0d, Math.min(BatchService.MAX_OVER_RATIO, overRatioOverride));
        List<Map<String, Object>> candidates = batchRows(sourcePanel, sourceNo, srcItems, sent, returned, ratio);
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> r : candidates) byKey.put(str(r.get("lineKey")), r);

        java.util.Set<String> resvBatches = new java.util.TreeSet<>();
        List<Map<String, Object>> picked = new ArrayList<>();   // {item, row, qty, resvBatch, lineKey}
        if (qtyByLineKey == null) {
            // 一次性整送(推式按钮/选单):只走**订单行**的剩余量,不动隔离行
            // (用户口径:隔离行"没有作废之前不会与生单有关联",要它必须显式勾选)
            for (Map<String, Object> m : srcItems) {
                Map<String, Object> r = byKey.get(sourceNo + "#" + m.get("id"));
                if (r == null) continue;
                double qty = numOf(r.get("剩余数量"));
                if (qty <= 0.000001) continue;
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("item", m);
                p.put("row", r);
                p.put("qty", qty);
                p.put("resvBatch", "");
                p.put("lineKey", str(r.get("lineKey")));
                picked.add(p);
            }
        } else {
            for (Map.Entry<String, Double> e : qtyByLineKey.entrySet()) {
                String lineKey = e.getKey();
                double qty = e.getValue() == null ? 0d : e.getValue();
                if (qty <= 0.000001) continue;                       // 本次不送
                Map<String, Object> r = byKey.get(lineKey);
                if (r == null) throw new IllegalStateException("送料行不存在或已失效:" + lineKey);
                Map<String, Object> m = sourceItemOf(srcItems, orderKeyOf(lineKey));
                if (m == null) throw new IllegalStateException("送料行对应的来源明细已不存在:" + lineKey);
                boolean isolated = isIsolatedKey(lineKey);
                String resvBatch = isolated ? str(r.get("批次号")) : "";
                if (isolated) {
                    // 隔离行(已打印):数量就是印在标签上的量,不许超;批次号强制取材料码上的号
                    double capPending = numOf(r.get("剩余数量"));
                    if (capPending <= 0.000001) {
                        throw new IllegalStateException("第 " + r.get("行号") + " 行批次号 " + resvBatch
                                + " 的已打印量已经生过单了,不能重复生单(如需再送请先在采购订单重新打印材料码)");
                    }
                    if (qty > capPending + 0.000001) {
                        throw new IllegalStateException("第 " + r.get("行号") + " 行按打印批次号 " + resvBatch + " 送料量 "
                                + round2(qty) + " 超出该批次号的未生单量 " + round2(capPending)
                                + "(已打印未生单的量才可按该号生单;超出部分请作为未打印量填写)");
                    }
                    resvBatches.add(resvBatch);
                } else {
                    // 订单行:上限按**切掉打印量后**的数量算(超送额度也随之按扣后数量算)
                    double capFree = numOf(r.get("可送上限"));
                    if (qty > capFree + 0.000001) {
                        throw new IllegalStateException("第 " + r.get("行号") + " 行本次送料量 " + round2(qty)
                                + " 超出允许上限 " + round2(capFree) + "(该行数量 " + round2(numOf(r.get("数量")))
                                + "(订单数量 " + round2(numOf(r.get("订单数量"))) + " 已切走已打印 "
                                + round2(numOf(r.get("已打印数量"))) + ") ×(1 + 超送比例 "
                                + Math.round(ratio * 100) + "%)− 已送 " + round2(numOf(r.get("已送数量")))
                                + " + 已退回 " + round2(numOf(r.get("已退回数量"))) + ")");
                    }
                }
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("item", m);
                p.put("row", r);
                p.put("qty", qty);
                p.put("resvBatch", resvBatch);
                p.put("lineKey", lineKey);
                picked.add(p);
            }
        }
        // 一张单只能一个批次号:勾到多个已打印批次时,请按号分开生单(前端按号分组逐组调用)
        if (resvBatches.size() > 1) {
            throw new IllegalStateException("一张" + tgtDef.displayName(false) + "只能是一个批次号,"
                    + "本次勾选的已打印行涉及 " + String.join("、", resvBatches)
                    + " 共 " + resvBatches.size() + " 个批次号,请按批次号分开生单");
        }
        String printedBatchNo = resvBatches.isEmpty() ? "" : resvBatches.iterator().next();
        if (picked.isEmpty()) {
            throw new IllegalStateException("该单据已无剩余可送(各明细行均已送满)");
        }

        // 4) 头/行映射(与选单共用 buildSelectConfig),再覆盖 本次数量 + 批次键
        Map<String, Object> maps = configService.flowMaps(sourcePanel, targetPanel);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + targetPanel);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");
        String tgtQtyLabel = qtyLabelOf(tgtDef, "detail");

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put("来源单据", srcDef.name());
        targetHead.put("来源单号", sourceNo);

        // 批次键 + 批次号(2026-10-04 口径:**生单即定号**,且在生单对话框里可当场改)
        // · 批次键:来源单已带「批次键」时**继承**它(键在「采购订单→送料暂收单」这一跳产生),
        //   否则本跳就是链路头一跳 → 新登记一行 ACTIVE 台账,把该行 id 当键逐站带下去;
        // · 批次号:来源单已有号(下游各跳)→ 原样继承(**忽略**传进来的覆盖值,不让下游把上游的号改飘);
        //   来源单没号(链路头一跳)→ ① 对话框里人工填的 batchNoOverride(用户口径「生单时就能改」)
        //   → ② 都空则按「供应商编码去掉 YJ- 前缀 + - + 当天」现取一个(编码为空退回纯日期)。
        //   单头与全部明细行写**同一个号** —— 用户口径「头与下面的明细项目批次号一致」,
        //   且不再需要"入库审核时逆流回填上游"(该机制已删除)。
        // 注:供应商编码要**先看来源单头、再看目标单头**(链路各单异名,映射可能刚把
        //     供应商编码→供应商代码 写进 targetHead),故这段必须排在 targetHead 之后。
        Object srcKeyObj = head.get("批次键");
        Integer inheritKey = srcKeyObj instanceof Number n ? n.intValue()
                : (srcKeyObj == null || String.valueOf(srcKeyObj).isBlank() ? null
                : Integer.valueOf(String.valueOf(srcKeyObj).trim()));
        String inherited = str(head.get("批次号"));
        String batchNo;
        if (!printedBatchNo.isEmpty()) {
            // ★ 材料码预约(2026-10-04):批次号**以打印记录为准** —— 标签已经印好贴在实物上,
            //   对话框输入框前端也已锁定,这里再兜一道(输入值若与打印号不同直接拒,不做静默覆盖)。
            if (!inherited.isEmpty() && !inherited.equals(printedBatchNo)) {
                throw new IllegalStateException("来源单批次号为 " + inherited + ",与选中的已打印批次号 "
                        + printedBatchNo + " 不一致,不能生单");
            }
            if (!str(batchNoOverride).isEmpty() && !str(batchNoOverride).equals(printedBatchNo)) {
                throw new IllegalStateException("本次填写的批次号 " + str(batchNoOverride) + " 与选中的已打印批次号 "
                        + printedBatchNo + " 不一致:勾了已打印行时批次号以材料码为准,不能改");
            }
            batchNo = printedBatchNo;
        } else if (!inherited.isEmpty()) {
            batchNo = inherited;                       // 下游:继承,不接受覆盖
        } else {
            String manual = str(batchNoOverride);      // 头一跳:生单对话框里人工改的号优先
            if (manual.length() > BATCH_NO_MAX) {
                throw new IllegalArgumentException("批次号过长(最多 " + BATCH_NO_MAX + " 个字符):" + manual);
            }
            batchNo = manual.isEmpty()
                    ? BatchService.buildBatchNo(supplierCodeOf(head, targetHead), java.time.LocalDate.now())
                    : manual;
        }
        int batchId = inheritKey != null ? inheritKey
                : batchService.createBatch(sourcePanel, sourceNo, targetPanel, batchNo, user);

        targetHead.put("批次键", batchId);      // 链路键:逐站继承(目标面板未登记该字段时被通用保存忽略)
        setIfRegistered(targetHead, tgtDef, "header", "批次号", batchNo);   // 生单即定号(头)
        String dateLabel = "单据日期";
        if (tgtDef.dateCol() != null && !tgtDef.dateCol().isBlank()) {
            PanelRegistry.FieldDef df = tgtDef.byCol(tgtDef.dateCol());
            if (df != null) dateLabel = df.label();
        }
        targetHead.put(dateLabel, java.time.LocalDate.now().toString());

        boolean rowHasBatch = tgtDef.fieldsAt("detail").stream().anyMatch(f -> "批次号".equals(f.label()));
        List<Map<String, Object>> targetItems = new ArrayList<>();
        for (Map<String, Object> p : picked) {
            Map<String, Object> item = (Map<String, Object>) p.get("item");
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = item.get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            row.put(tgtQtyLabel, p.get("qty"));   // 本次送料数量
            if (rowHasBatch) row.put("批次号", batchNo);   // 行随单头(同一批次号,头行一致)
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
            Map<String, Object> pk = picked.get(i);
            Map<String, Object> item = (Map<String, Object>) pk.get("item");
            Map<String, Object> srcRow = (Map<String, Object>) pk.get("row");
            double qty = (double) pk.get("qty");
            sum += qty;
            // ★ 占用写在**本次勾选那一行自己的 lineKey** 上:隔离行有专属键(`...#行id@打印行id`),
            //   于是"从已打印那部分送的"与"从原行送的"各记各的 —— 隔离行能准确显示已生单/未生单,
            //   原行的已送也不会把打印量算进去(见 isolatedLineKey 注释)。
            links.add(new VoucherFlowService.BatchLine(
                    str(pk.get("lineKey")),
                    i < tgtIds.size() ? newNo + "#" + tgtIds.get(i) : null,
                    item.get("物料编码") == null ? null : String.valueOf(item.get("物料编码")),
                    numOf(srcRow == null ? item.get("数量") : srcRow.get("数量")), qty));
        }
        voucherFlow.linkBatch(sourcePanel, sourceNo, targetPanel, newNo, null, batchId, links);
        // 报账占用链路上的批号:form_flow_link.batch_no 一直留空会让「按批次反查链路」少一条线索
        jdbc.update("UPDATE form_flow_link SET batch_no = ? WHERE batch_id = ? AND ISNULL(batch_no, N'') = N''",
                batchNo, batchId);
        if (inheritKey == null) batchService.bind(batchId, targetPanel, newNo, round2(sum)); // 继承批次键时不改台账(归订单那一跳)

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("批次号", batchNo);             // 生单即定号:前端直接显示,不再是"以后再取"
        out.put("批次键", batchId);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", targetPanel);
        out.put("本次送料合计", round2(sum));
        return out;
    }

    /** 非空字符串(去空白);null → 空串 */
    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    /**
     * 供应商编码:来源单头优先(链路上游已带),退回**目标单头映射后的值** ——
     * 链路各单异名(暂收/检验/退回叫「供应商代码」,采购入库叫「供应商编码」),
     * 而 PU_ORDER→QC_RECV 的映射正是 供应商编码 → 供应商代码,故两处都要看。
     */
    private static String supplierCodeOf(Map<String, Object> srcHead, Map<String, Object> tgtHead) {
        for (Map<String, Object> m : List.of(srcHead, tgtHead)) {
            for (String k : List.of("供应商编码", "供应商代码")) {
                String v = str(m.get(k));
                if (!v.isEmpty()) return v;
            }
        }
        return "";
    }

    /**
     * 只在目标面板**注册了该字段**时才写入(未注册的键会被通用保存静默丢弃,先判一下更直观)。
     * 链路四单都注册了表头「批次号」,此处是防御性写法(将来某站取消该字段也不会写入垃圾键)。
     */
    private static void setIfRegistered(Map<String, Object> target, PanelRegistry.PanelDef def,
                                       String place, String label, Object value) {
        if (def.fieldsAt(place).stream().anyMatch(f -> label.equals(f.label()))) target.put(label, value);
    }
}
