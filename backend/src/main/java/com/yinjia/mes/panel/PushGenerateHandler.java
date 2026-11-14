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
            // 「WO_ORDER|生成领料单」(WoPickingHandler 按默认 BOM 展开生成领料单草稿)已随 BOM 下架移除(2026-10-04)
            // 生产工单生单:按订单行 1:1 生成(参考库口径),由 ManuScheduleHandler 接管
            "SO_ORDER|生成生产工单",
            // 送料暂收单生单(2026-10-05):**一条动作两个去向** —— 按商品基本档案「来料检验」逐行分流到
            // 来料检验单 / 采购入库单(PUSH_TARGETS 里登记的 QC_INSP 只是路由标记),由 QcRecvGenerateHandler 接管
            "QC_RECV|生成检验或入库单");

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
        PanelRegistry.PanelDef tgtDef = registry.panel(target);
        targetHead.put(colLabel(tgtDef, "来源单据", "来源单据"), srcDef.name());
        targetHead.put(colLabel(tgtDef, "来源单号", "来源单号"), sourceNo);
        // 单据日期=创建当日,不继承来源单日期(2026-09-17 用户口径)。注意:head 键=目标字段标签
        // (save 按标签映射列),而 yj_panel.date_col 是列名(如 QC_RECV 列=单据日期/标签=日期),
        // 故先按列名反查目标字段再用其标签写入;查不到时兜底「单据日期」标签。
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
        // 仓位预设(2026-10-09):免检直达(暂收→入库)、选单、分批这条路径同样要预设仓位,
        // 口径与 ButtonService.inspAutoPurchaseIn(检验审核→入库)完全一致 —— 共用 presetBinFor 一份实现:
        //   物料默认(bs_inv.默认仓位) ⇢ 该仓默认(bs_wh_loc.是否默认),且仅当该仓启用仓位管理=1。
        // 仓库取本行已映射的值;取不到时回落来源行的「仓库」(detailMap 未登记该列时的兜底)。
        // ⚠ 2026-11-13:只有本行**还没有**仓位时才预设 —— 用户/上游链路已经带下来的仓位不许被覆盖
        //    (生单对话框按行选的仓位、暂收行带下来的仓位都走这条路,覆盖等于把用户的选择改掉)。
        if (row.get("仓位") != null && !String.valueOf(row.get("仓位")).isBlank()) return;
        Object wh = row.get("仓库") != null ? row.get("仓库") : (srcItem == null ? null : srcItem.get("仓库"));
        String bin = buttonService.presetBinFor(
                srcItem == null || srcItem.get("物料编码") == null ? null : String.valueOf(srcItem.get("物料编码")),
                wh == null ? null : String.valueOf(wh));
        if (bin != null) row.put("仓位", bin);
    }

    /**
     * 生单对话框里按行选的「仓库 / 仓位」键(2026-11-13 用户口径)。
     * 目标面板**没有**对应明细标签的键静默丢弃(与通用保存"按标签映射列"同一口径);
     * 唯一例外是仓库:来料检验单的仓库列叫「仓库代码」,按异名落上去。
     */
    private static final List<String> WHBIN_KEYS = List.of(
            "仓库", "仓库编码", "仓库id", "仓库启用仓位管理", "仓位", "仓位编码", "仓位名称", "仓位id");

    /** 取某行的仓库/仓位预填(没有则 null;空 map 也按没有处理) */
    private static Map<String, Object> whBinOf(Map<String, Map<String, Object>> whBinByLine, String lineKey) {
        if (whBinByLine == null || lineKey == null) return null;
        Map<String, Object> v = whBinByLine.get(lineKey);
        return v == null || v.isEmpty() ? null : v;
    }

    /** 把「仓库 / 仓位」预填落到目标明细行(见 {@link #WHBIN_KEYS}) */
    private void applyWhBin(Map<String, Object> row, Map<String, Object> whBin,
                            PanelRegistry.PanelDef tgtDef) {
        if (row == null || whBin == null || whBin.isEmpty() || tgtDef == null) return;
        java.util.Set<String> det = new java.util.HashSet<>();
        for (PanelRegistry.FieldDef f : tgtDef.fieldsAt("detail")) det.add(f.label());
        for (String k : WHBIN_KEYS) {
            Object v = whBin.get(k);
            if (v == null || String.valueOf(v).isBlank()) continue;
            if (det.contains(k)) {
                row.put(k, v);
            } else if ("仓库".equals(k) && det.contains("仓库代码")) {
                row.put("仓库代码", v);     // 来料检验行的仓库列异名
            }
        }
    }

    /**
     * 目标面板「来源单据 / 来源单号」两列的**字段标签** —— 按列名反查,不写死标签。
     *
     * <p>为什么:2026-11-11 用户口径「采购入库单表头最末尾加一个来源…和显示对应的单据编号」,
     * 采购入库单把这两列的显示名正名为 **来源** / 来源单号,并挪到表头末尾
     * (见 {@code tools/migrate-purchase-in-source-20261111.sql}),其余面板仍叫「来源单据」。
     * 通用保存是**按标签映射列**的,查不到标签的键会被静默丢弃 —— 写死「来源单据」就等于
     * 入库单这两个字段永远空着,而其余面板照旧(极难察觉)。
     */
    private static String colLabel(PanelRegistry.PanelDef def, String col, String fallback) {
        if (def == null) return fallback;
        PanelRegistry.FieldDef f = def.byCol(col);
        return f == null ? fallback : f.label();
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
     * 2026-10-19 口径:批次号在**生单那一刻**定稿(**纯日期 yyyyMMdd**,如 20261019;
     * 2026-10-04 的"供应商编码 + 日期"已被用户否掉),
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
            // ★「已生单补登」的打印(给已收的量补打码)**不参与**这里的两件事:
            //   ① 不切走原行数量(量早就送过了,再切一遍等于把同一批货算两次);
            //   ② 不出隔离行(没有"待生单"的量,出了会让人以为还能再生一次单)。
            if (isSupplement(lb)) continue;
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
            // 可送上限按**该行单位精度**取整(2026-11-09):个/卷这类计件单位 → 整数,
            // kg/米 → 3 位;不再出现 24×1.2−24=4.799999999999997 这种纸面小数。
            int rowDecimals = intOf(row.get("小数位数"));
            row.put("可送上限", BatchService.overAllowance(carved, used, ret, ratio, rowDecimals));
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

    /**
     * 行骨架(两类行共用的展示字段)。
     *
     * <p>物料口径按**候选字段**取(2026-10-31):各面板对同一件事的叫法不一样 ——
     * 采购订单/暂收单叫「物料编码·物料名称·单位」,销售订单叫「存货编码·存货名称」,
     * 生产工单叫「产品编码·产品名称」。此前写死「物料编码」,于是 销售订单→销售出库单 /
     * 生产工单→产成品入库单 的对话框里物料列整列是空的(看着像"没数据")。
     */
    private Map<String, Object> baseRow(Map<String, Object> it, String lineKey, Object id) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("lineKey", lineKey);
        row.put("id", id);
        row.put("行号", it.get("行号"));
        row.put("物料编码", firstOf(it, SRC_CODE_FIELDS));
        row.put("物料名称", firstOf(it, SRC_NAME_FIELDS));
        row.put("规格型号", it.get("规格型号"));
        Object unit = it.get("计量单位") != null ? it.get("计量单位") : firstOf(it, SRC_UNIT_FIELDS);
        row.put("计量单位", unit);
        // 该行单位的小数位数(超送取整用,2026-11-09):计件单位=0、kg/米=3;
        // 前端拿它算本地可送上限与输入框精度,后端 batchRows/校验也按它取整 —— 两边同源。
        row.put("小数位数", batchService.unitDecimals(unit == null ? "" : String.valueOf(unit)));
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

    /** 该打印行是否「已生单补登」(Y=给已收的量补打码:不切量、不出隔离行、不参与生单) */
    private static boolean isSupplement(Map<String, Object> labelRow) {
        Object v = labelRow == null ? null : labelRow.get("补登");
        if (v instanceof Boolean b) return b;
        return "Y".equalsIgnoreCase(str(v));
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
                ? BatchService.buildBatchNo(java.time.LocalDate.now())
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
     * - **批次号在生单这一刻就写**(2026-10-04 口径「生单即定号」;号本身按 2026-10-19 用户口径改回纯日期):
     *   链路头一跳(采购订单→送料暂收单)= 按「**当天 yyyyMMdd**」取号(如 2026-10-19 ⇒ 20261019,
     *   见 BatchService.buildBatchNo;改版前的"供应商编码 + 日期"如 `WR-20261019` 已作废);
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
        return generateBatch(sourcePanel, targetPanel, sourceNo, user, qtyByLineKey, overRatioOverride,
                batchNoOverride, null);
    }

    /**
     * 分批生单(带**行级仓库/仓位**预填):whBinByLine = lineKey → {仓库,仓位,...}(生单对话框按行选的)。
     *
     * <p>见 {@link #generateOne} 的同名参数说明。落点在这条链路的**合并行之后**:同一订单行的
     * 隔离行 + 原行会被合并成一行,这时取该组里第一个带了仓库/仓位的成员(同一订单行本就是同一物料,
     * 仓库/仓位也该是同一个值)。
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateBatch(String sourcePanel, String targetPanel, String sourceNo,
                                             String user, Map<String, Double> qtyByLineKey,
                                             Double overRatioOverride, String batchNoOverride,
                                             Map<String, Map<String, Object>> whBinByLine) {
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
        targetHead.put(colLabel(tgtDef, "来源单据", "来源单据"), srcDef.name());
        targetHead.put(colLabel(tgtDef, "来源单号", "来源单号"), sourceNo);

        // 批次键 + 批次号(2026-10-04 口径:**生单即定号**,且在生单对话框里可当场改)
        // · 批次键:来源单已带「批次键」时**继承**它(键在「采购订单→送料暂收单」这一跳产生),
        //   否则本跳就是链路头一跳 → 新登记一行 ACTIVE 台账,把该行 id 当键逐站带下去;
        // · 批次号:来源单已有号(下游各跳)→ 原样继承(**忽略**传进来的覆盖值,不让下游把上游的号改飘);
        //   来源单没号(链路头一跳)→ ① 对话框里人工填的 batchNoOverride(用户口径「生单时就能改」)
        //   → ② 都空则按「**当天日期 yyyyMMdd**」现取一个(2026-10-19 用户口径:批次号改回纯日期,
        //        不再是"供应商编码 + 日期";改版前供应商 YJ-WR 会取成 `WR-20261019`,现在只有 `20261019`)。
        //   单头与全部明细行写**同一个号** —— 用户口径「头与下面的明细项目批次号一致」,
        //   且不再需要"入库审核时逆流回填上游"(该机制已删除)。
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
                    ? BatchService.buildBatchNo(java.time.LocalDate.now())
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
        // 行级「采购单号」(2026-11-13 用户口径「明细行都要带采购订单号,不能只有表头有」)
        boolean rowHasPoNo = detailHas(tgtDef, "采购单号");
        // ★ 合并成一行明细(2026-10-04 用户口径「与打印的明细组合生单是需要合并的」):
        //   同一个采购订单行上,"已打印那一行(隔离行)"与"原行未打印量"如果被一起勾上,
        //   生成的单据里**只出现一行、数量相加**(400 = 350 + 50),不再出现同一物料两行。
        //   但**占用(link)仍按各自的行键各记一笔** —— 已生单量/已送量分账不变(见下面 links 那段),
        //   所以隔离行照样能显示"已生单 50",原行的已送也照样只算 350。
        //   分组键 = 行键去掉 `@...` 的订单行键(同一订单行的所有勾选合并;只勾一行时分组里就一条,行为不变)。
        Map<String, List<Map<String, Object>>> groups = new LinkedHashMap<>();
        Map<String, Integer> groupIndex = new LinkedHashMap<>();
        List<String> groupKeys = new ArrayList<>();
        for (Map<String, Object> p : picked) {
            String gk = orderKeyOf(str(p.get("lineKey")));
            if (!groups.containsKey(gk)) { groups.put(gk, new ArrayList<>()); groupKeys.add(gk); groupIndex.put(gk, groupKeys.size() - 1); }
            groups.get(gk).add(p);
        }
        List<Map<String, Object>> targetItems = new ArrayList<>();
        for (String gk : groupKeys) {
            List<Map<String, Object>> members = groups.get(gk);
            Map<String, Object> item = (Map<String, Object>) members.get(0).get("item");
            double qty = 0d;
            for (Map<String, Object> p : members) qty += (double) p.get("qty");
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = item.get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            row.put(tgtQtyLabel, round2(qty));      // 合并后的本次送料数量(打印量 + 未打印量)
            if (rowHasBatch) row.put("批次号", batchNo);   // 行随单头(同一批次号,头行一致)
            // 行级「采购单号」(2026-11-13 用户口径「明细行都要带采购订单号,不能只有表头有」):
            // 头一跳(来源 = 采购订单)时把**订单号**写进每一行;下游各站由 detailMap 的
            // 采购单号→采购单号 同义词原样继承(这里不覆盖,否则会把上游订单号写成暂收单号)。
            if (rowHasPoNo && isOrderSource(sourcePanel)) row.put("采购单号", sourceNo);
            applySourceFlags(sourcePanel, targetPanel, item, row);
            // 生单对话框按行选的 仓库/仓位:合并组里取第一个有值的成员(同一订单行 = 同一物料同一仓位)
            Map<String, Object> whBin = null;
            for (Map<String, Object> p : members) {
                whBin = whBinOf(whBinByLine, str(p.get("lineKey")));
                if (whBin != null) break;
            }
            applyWhBin(row, whBin, tgtDef);
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
        for (Map<String, Object> pk : picked) {
            Map<String, Object> item = (Map<String, Object>) pk.get("item");
            Map<String, Object> srcRow = (Map<String, Object>) pk.get("row");
            double qty = (double) pk.get("qty");
            sum += qty;
            // ★ 占用写在**本次勾选那一行自己的 lineKey** 上:隔离行有专属键(`...#行id@打印行id`),
            //   于是"从已打印那部分送的"与"从原行送的"各记各的 —— 隔离行能准确显示已生单/未生单,
            //   原行的已送也不会把打印量算进去(见 isolatedLineKey 注释)。
            //   明细行被合并成一行的场合(同一订单行的隔离行 + 原行),两条 link **指向同一行**:
            //   单据上是一行 400,账上仍是 350 + 50 两笔,两边都不失真。
            Integer gi = groupIndex.get(orderKeyOf(str(pk.get("lineKey"))));
            Integer tgtId = (gi != null && gi < tgtIds.size()) ? tgtIds.get(gi) : null;
            links.add(new VoucherFlowService.BatchLine(
                    str(pk.get("lineKey")),
                    tgtId == null ? null : newNo + "#" + tgtId,
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

    // ==================== 统一生单对话框(2026-10-31 用户口径) ====================

    /**
     * 「统一生单对话框」的候选行(勾选 + 本次数量)。
     *
     * <p>用户口径(2026-10-31):「**生单**也要变成可以勾选的和选择数量的(现在只有采购订单的生单做了特殊处理),
     * 非定制化的生单只要可以勾选和选择数量就可以」;并要一个「**批量生单**」——
     * 在左侧单据选择栏勾多张来源单 → 打开一个界面列出这些单据的明细行 → 再勾行/填量 → 转单。
     * 第二轮补充:「所有单据只要有生单和批量生单这个按钮的,都要实现 —— **送料暂收就不能批量,
     * 而且生单也没有勾选**」。
     *
     * <p>所以本方法把「一张来源单能生什么」摊平成同一份行契约,**分批链路与普通推式生单共用**:
     * <ul>
     *   <li><b>分批链路</b>(目标面板配了表头「批次号」,如 采购订单→送料暂收单):直接复用
     *       {@link #batchRows} —— 订单行(数量已切走已打印量)+ 已打印隔离行,已送/已退回/剩余/可送上限全在内,
     *       批次号与服务端预告的 nextBatchNo 一并给出(生单即定号);</li>
     *   <li><b>普通推式生单</b>(如 销售订单→销售出库单、送料暂收→检验/入库):按
     *       {@code form_flow_link} 的**行级**已生单量算剩余({{@link BatchService#sentByLineKey}}),
     *       于是「先送一部分行、剩下的以后再生」是可行的 —— 这正是"可以勾选和选择数量"的前提;</li>
     *   <li>行键统一 {@code {来源单号}#{来源明细行id}}(与选单/分批同一约定),前端只认它。</li>
     * </ul>
     *
     * <p>「销售订单 → 生产工单」「生产工单 → 产成品入库单」按用户口径**保持原来的不变**
     * (不进本对话框,前端也不给这两个动作出「批量生单」),故这里不必为它们做特殊处理。
     *
     * @param sourceNos 勾选的来源单据号(单张 = 原「生单」,多张 = 新「批量生单」)
     */
    public Map<String, Object> pushPreview(String sourcePanel, String action, List<String> sourceNos) {
        String target = pushTarget(sourcePanel, action);
        if (target == null) throw new IllegalStateException("该动作没有可用的生单目标:" + action);
        boolean batchFlow = isBatchTarget(target);
        String[] filter = configService.detailFilter(sourcePanel, action);
        List<Map<String, Object>> docs = new ArrayList<>();
        for (String no : sourceNos) {
            if (no == null || no.isBlank()) continue;
            docs.add(previewDoc(sourcePanel, action, target, no, batchFlow, filter));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sourcePanel", sourcePanel);
        out.put("action", action);
        out.put("targetPanel", target);
        out.put("targetName", targetNameOf(sourcePanel, action, target));
        out.put("sourceName", registry.panel(sourcePanel).displayName(false));
        out.put("batchFlow", batchFlow);
        out.put("overRatio", batchService.overRatio());
        out.put("docs", docs);
        return out;
    }

    /**
     * 对话框标题上的目标名。
     *
     * <p>送料暂收单的「生单」是**一条动作两个去向**(按商品档案「来料检验」逐行分流到
     * 来料检验单 / 采购入库单,见 {@link QcRecvGenerateHandler}),而 PUSH_TARGETS 里登记的
     * QC_INSP 只是**路由标记** —— 照它显示会变成「生单 → 来料检验单」,可实际还会生成采购入库单,
     * 用户会以为单子漏了。故这一条把两个去向都写出来。
     */
    private String targetNameOf(String sourcePanel, String action, String target) {
        if (QcRecvGenerateHandler.PANEL.equals(sourcePanel) && QcRecvGenerateHandler.ACTION.equals(action)) {
            String a = registry.panel("QC_INSP").displayName(false);
            String b = registry.panel("PURCHASE_IN").displayName(false);
            return a + " / " + b;
        }
        return registry.panel(target).displayName(false);
    }

    /** 一张来源单的生单候选(头 + 行 + 批次预告),见 {@link #pushPreview} 的行契约说明 */
    private Map<String, Object> previewDoc(String sourcePanel, String action, String target, String sourceNo,
                                           boolean batchFlow, String[] filter) {
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        if (src == null || src.isEmpty()) throw new IllegalStateException("来源单据不存在:" + sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        head.remove("detail");
        // 单据已被别人删掉/作废(列表是几秒前的快照)时,loadOneDoc 只回一个 {编号, 单据状态} 的空壳 ——
        // 不拦就会在对话框里显示一段"没有明细"的空单,或者生单时被"仅已审核单据可生单,当前状态:草稿"
        // 这种与用户所见(列表里写着已审核)对不上的话误导。这里直接说清"单据不在了"。
        if (looksEmptyDoc(head)) throw new IllegalStateException("来源单据不存在或已被删除:" + sourceNo);
        List<Map<String, Object>> items = applyDetailFilter(new ArrayList<>(itemsOf(src)), filter);

        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("sourceNo", sourceNo);
        doc.put("status", str(buttonService.docStatus(sourcePanel, sourceNo).get("status")));
        doc.put("header", head);
        doc.put("batchFlow", batchFlow);
        if (batchFlow) {
            Map<String, Double> sent = batchService.sentByLineKey(sourcePanel, sourceNo);
            Map<String, Double> returned = batchService.returnedByOrderLine(sourceNo);
            doc.put("lines", batchRows(sourcePanel, sourceNo, items, sent, returned, batchService.overRatio()));
            // 与服务端 generateBatch 同一公式:来源单已有号 → 继承(下游站),否则按当天取号(链路头一跳)
            String srcBatch = str(src.get("批次号"));
            doc.put("batchInherited", !srcBatch.isEmpty());
            doc.put("nextBatchNo", srcBatch.isEmpty() ? BatchService.buildBatchNo(java.time.LocalDate.now()) : srcBatch);
            doc.put("batches", batchService.batches(sourcePanel, sourceNo));
        } else {
            doc.put("lines", genericRows(items, sourceNo, batchService.sentByLineKey(sourcePanel, sourceNo)));
            doc.put("batchInherited", false);
            doc.put("nextBatchNo", "");
            doc.put("batches", List.of());
        }
        return doc;
    }

    /** 生单动作的行过滤(与 {@link #handle} 同一口径;无登记则原样返回) */
    private List<Map<String, Object>> applyDetailFilter(List<Map<String, Object>> items, String[] filter) {
        if (filter == null) return items;
        List<Map<String, Object>> out = items.stream().filter(it -> {
            Object v = it.get(filter[0]);
            boolean eq = filter[2].equals(v == null ? "" : String.valueOf(v));
            return "=".equals(filter[1]) ? eq : !eq;
        }).collect(java.util.stream.Collectors.toList());
        return out;
    }

    /** 来源行数量的字段候选(与 VoucherFlowService.QTY_FIELDS / 分批的 数量 同口径) */
    private static final List<String> SRC_QTY_FIELDS = List.of(
            "数量", "实收数量", "送检数量", "计划数量", "派工数量", "需用数量", "领料数量");
    private static final List<String> SRC_CODE_FIELDS = List.of(
            "物料编码", "存货编码", "产品编码", "材料编码");
    private static final List<String> SRC_NAME_FIELDS = List.of(
            "物料名称", "存货名称", "产品名称", "材料名称");
    private static final List<String> SRC_UNIT_FIELDS = List.of(
            "计量单位", "单位", "销售单位");

    /** 取第一个非空字段值(优先给定顺序;都没有返回 null) */
    private static Object firstOf(Map<String, Object> row, List<String> fields) {
        if (row == null) return null;
        for (String f : fields) {
            Object v = row.get(f);
            if (v != null && !String.valueOf(v).trim().isEmpty()) return v;
        }
        return null;
    }

    /**
     * 普通推式生单的候选行:每行给 数量 / 已生单 / 已退回(普通链路恒 0) / 剩余 / 可生单上限。
     * 与分批行保持**同一套键**(数量/已送数量/已退回数量/剩余数量/可送上限/rowKind),
     * 前端一张表就能同时渲染两种链路 —— 两套键名迟早会漂。
     */
    private List<Map<String, Object>> genericRows(List<Map<String, Object>> items, String sourceNo,
                                                  Map<String, Double> sent) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> it : items) {
            Object id = it.get("id");
            String lineKey = sourceNo + "#" + (id == null ? "" : String.valueOf(id));
            double qty = round2(numOf(firstOf(it, SRC_QTY_FIELDS)));
            double used = round2(sent == null ? 0d : sent.getOrDefault(lineKey, 0d));
            double left = round2(Math.max(0d, qty - used));
            Map<String, Object> row = baseRow(it, lineKey, id);
            row.put("rowKind", "order");
            row.put("订单数量", qty);
            row.put("数量", qty);
            row.put("已送数量", used);          // 普通链路 = 已生成数量(按行级占用求和)
            row.put("已退回数量", 0d);
            row.put("剩余数量", left);
            row.put("可送上限", left);
            rows.add(row);
        }
        return rows;
    }

    /**
     * 「按勾选行 + 本次数量」生单(**统一入口**:单张=原「生单」,多张=「批量生单」)。
     *
     * <p>分批链路交给 {@link #generateBatch}(批次号/超送/材料码隔离行那一整套口径一条不改);
     * 其余链路走 {@link #generateLines}(整单映射 → 只映射勾选行、数量取本次填的值)。
     *
     * <p>为什么拆成"一张单一个事务"(由调用方逐张调用,各自 @Transactional):
     * 批量生单里某一张失败(比如已被别人送满)不该把已经生成好的单一起回滚 ——
     * 调用方(PxController)逐张收集「生成 / 失败」两张清单回给界面。
     */
    @Transactional
    public Map<String, Object> generateOne(String sourcePanel, String action, String sourceNo, String user,
                                           Map<String, Double> qtyByLineKey, String batchNo) {
        return generateOne(sourcePanel, action, sourceNo, user, qtyByLineKey, batchNo, null);
    }

    /**
     * 生单(带**行级仓库/仓位**预填)。
     *
     * <p>2026-11-13 用户口径:「从采购订单生单的时候就开始预填仓库仓位」「生单可以选仓库和仓位,
     * 可以每行不一样,也可以所有行带入第一个填入的仓库和仓位」。
     * 前端在生单对话框里按行选好 仓库/仓位 后随行一起提交({@code whBinByLine}: lineKey → 值),
     * 这里在**行映射之后**落到目标行上(用户选的优先于来源行自动带过来的值),
     * 后续各站(暂收→检验→入库)只要目标面板有对应字段,就由映射继续往下带。
     */
    @Transactional
    public Map<String, Object> generateOne(String sourcePanel, String action, String sourceNo, String user,
                                           Map<String, Double> qtyByLineKey, String batchNo,
                                           Map<String, Map<String, Object>> whBinByLine) {
        String target = pushTarget(sourcePanel, action);
        if (target == null) throw new IllegalStateException("该动作没有可用的生单目标:" + action);
        if (isBatchTarget(target)) {
            return generateBatch(sourcePanel, target, sourceNo, user, qtyByLineKey, null, batchNo, whBinByLine);
        }
        return generateLines(sourcePanel, action, target, sourceNo, user, qtyByLineKey, whBinByLine);
    }

    /**
     * 普通推式生单的「按行/按量」版本(非分批链路)。
     *
     * <p>与 {@link #handle} 的区别只有两点,其余(状态闸门/头行映射/保存/占用留痕)完全同源:
     * <ol>
     *   <li>只映射**勾选的行**(qtyByLineKey 的键),数量取本次填的值 —— 不勾的行不进新单;</li>
     *   <li>占用按**行级本次量**写({@link VoucherFlowService#linkBatch}),于是剩余量可逐次核减:
     *       先送 300、剩下 200 之后再送,不再是"整单只能用一次"。</li>
     * </ol>
     * 校验与 {@link #pushPreview} 共用同一份候选行口径(剩余量 = 数量 − 行级已生单量),
     * 「对话框里看到的」与「真正校验用的」永远是同一份数。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> generateLines(String sourcePanel, String action, String target,
                                              String sourceNo, String user, Map<String, Double> qtyByLineKey,
                                              Map<String, Map<String, Object>> whBinByLine) {
        // 1) 来源必须已审核(与整单推式生单同一句话,前端置灰 + 后端兜底)
        String status = str(buttonService.docStatus(sourcePanel, sourceNo).get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可生单,当前状态:" + status);

        // 2) 载入来源单(头 + 行),并按生单动作过滤
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        PanelRegistry.PanelDef tgtDef = registry.panel(target);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        head.remove("detail");
        if (looksEmptyDoc(head)) throw new IllegalStateException("来源单据不存在或已被删除:" + sourceNo);
        List<Map<String, Object>> srcItems = applyDetailFilter(new ArrayList<>(itemsOf(src)),
                configService.detailFilter(sourcePanel, action));
        if (srcItems.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生单");

        // 3) 候选行(与预览同一口径) + 本次数量校验
        Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
        for (Map<String, Object> r : genericRows(srcItems, sourceNo,
                batchService.sentByLineKey(sourcePanel, sourceNo))) {
            byKey.put(str(r.get("lineKey")), r);
        }
        List<Map<String, Object>> picked = new ArrayList<>();   // {item, row, qty}
        if (qtyByLineKey != null) {
            for (Map.Entry<String, Double> e : qtyByLineKey.entrySet()) {
                String lineKey = e.getKey();
                double qty = e.getValue() == null ? 0d : e.getValue();
                if (qty <= 0.000001) continue;                   // 本次不生单
                Map<String, Object> r = byKey.get(lineKey);
                if (r == null) throw new IllegalStateException("生单行不存在或已失效:" + lineKey);
                double cap = numOf(r.get("可送上限"));
                if (qty > cap + 0.000001) {
                    // 行号可能为空(部分面板的明细没有 seq),别把提示写成「第 null 行」
                    String label = r.get("行号") == null || String.valueOf(r.get("行号")).isBlank()
                            ? "物料 " + str(r.get("物料编码")) + " 这一行"
                            : "第 " + r.get("行号") + " 行";
                    throw new IllegalStateException(label + "本次生单数量 " + round2(qty)
                            + " 超出剩余可生单量 " + round2(cap)
                            + "(该行数量 " + round2(numOf(r.get("数量"))) + " − 已生单 "
                            + round2(numOf(r.get("已送数量"))) + ")");
                }
                Map<String, Object> m = sourceItemOf(srcItems, lineKey);
                if (m == null) throw new IllegalStateException("生单行对应的来源明细已不存在:" + lineKey);
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("item", m);
                p.put("row", r);
                p.put("qty", qty);
                picked.add(p);
            }
        }
        if (picked.isEmpty()) throw new IllegalStateException("请至少勾选一行并填写本次生单数量");

        // 4) 头/行映射(与选单/整单推式生单共用 buildSelectConfig 的 headerMap/detailMap)
        Map<String, Object> maps = configService.flowMaps(sourcePanel, target);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + target);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");
        String tgtQtyLabel = qtyLabelOf(tgtDef, "detail");

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put(colLabel(tgtDef, "来源单据", "来源单据"), srcDef.name());
        targetHead.put(colLabel(tgtDef, "来源单号", "来源单号"), sourceNo);
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
            // 本次数量**压掉**映射带过来的整行数量(这正是"可以选择数量"的落点)
            row.put(tgtQtyLabel, round2((double) p.get("qty")));
            applySourceFlags(sourcePanel, target, item, row);
            // 生单对话框里按行选的 仓库/仓位(用户选择优先于映射带过来的值,见 applyWhBin)
            applyWhBin(row, whBinOf(whBinByLine, str(p.get("lineKey"))), tgtDef);
            targetItems.add(row);
        }

        // 5) 保存为目标草稿(复用通用保存语义:头行分表/默认值/号池取号)
        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", targetItems));
        Map<String, Object> saved = buttonService.save(tgtDef, formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // 5b) 检验目录联动(任何来源生成了来料检验单都要建报告草稿 + 目录行)
        if ("QC_INSP".equals(target)) qcCatalog.syncFromInspection(newNo, user);

        // 6) 行级占用:按本次量写(form_flow_link.source_line_key = 行键),剩余量据此逐次核减
        List<VoucherFlowService.BatchLine> links = new ArrayList<>();
        for (Map<String, Object> p : picked) {
            Map<String, Object> item = (Map<String, Object>) p.get("item");
            Map<String, Object> r = (Map<String, Object>) p.get("row");
            Object inv = firstOf(item, SRC_CODE_FIELDS);
            links.add(new VoucherFlowService.BatchLine(
                    str(r.get("lineKey")), null,
                    inv == null ? null : String.valueOf(inv),
                    numOf(r.get("数量")), (double) p.get("qty")));
        }
        voucherFlow.linkBatch(sourcePanel, sourceNo, target, newNo, null, null, links);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", target);
        return out;
    }

    /** 非空字符串(去空白);null → 空串 */
    private static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    /**
     * 「这张单其实不存在」的判据:单头里除了 编号/单据状态/saved 这些**由查询层兜底填的壳**之外,
     * 一个非空业务值都没有(见 {@link #previewDoc} 的调用点注释)。
     * 真实单据的单据日期/往来单位等必有值,不会被误判。
     */
    private static boolean looksEmptyDoc(Map<String, Object> head) {
        if (head == null) return true;
        for (Map.Entry<String, Object> e : head.entrySet()) {
            String k = e.getKey();
            if ("编号".equals(k) || "单据状态".equals(k) || "saved".equals(k)) continue;
            Object v = e.getValue();
            if (v != null && !String.valueOf(v).trim().isEmpty()) return false;
        }
        return true;
    }

    /**
     * 只在目标面板**注册了该字段**时才写入(未注册的键会被通用保存静默丢弃,先判一下更直观)。
     * 链路四单都注册了表头「批次号」,此处是防御性写法(将来某站取消该字段也不会写入垃圾键)。
     */
    private static void setIfRegistered(Map<String, Object> target, PanelRegistry.PanelDef def,
                                       String place, String label, Object value) {
        if (def.fieldsAt(place).stream().anyMatch(f -> label.equals(f.label()))) target.put(label, value);
    }

    /** 目标面板明细里有没有这个标签(合单生单写行级「采购单号」前先判) */
    private static boolean detailHas(PanelRegistry.PanelDef def, String label) {
        return def != null && def.fieldsAt("detail").stream().anyMatch(f -> label.equals(f.label()));
    }

    /**
     * 来源面板是不是**采购订单**(含供应商门户的采购订单副本)。
     *
     * <p>用来判断"本跳要不要把采购单号写进行":链路头一跳(采购订单)必须写;
     * 下游(暂收→检验→退回/入库)一律由映射继承,绝不拿 sourceNo 覆盖
     * —— 否则会把「采购单号」写成暂收单号,整条溯源就断了。
     */
    private static boolean isOrderSource(String sourcePanel) {
        return "PU_ORDER".equals(sourcePanel) || "SUPPLIER_PU_ORDER".equals(sourcePanel);
    }

    // ==================== 合单生单(2026-11-13 用户口径) ====================

    /**
     * **合单生单**:多张**同一供应商**的采购订单 → **一张**送料暂收单。
     *
     * <p>用户口径(2026-11-13):
     * 「采购订单新增一个合单生单在生单按钮下面,可以选择同一供应商的单据,进行合单,合成一张送料暂收单。
     *   并且要注意后面的逻辑(对应的行号有的是对应采购订单行号,是合单前的行号。有些对应行号的送料暂收后的
     *   行号是送料暂收的行号,是合单后的行号)」
     *
     * <p>与"批量生单"的区别(别混):批量生单 = N 张来源单各生成 N 张目标单(逐张、各自批次号);
     * 合单生单 = N 张来源单的**行并进同一张**目标单,共用**一个**批次号/单据号。
     *
     * <p><b>行号语义(本方法的核心约定)</b>:
     * <ul>
     *   <li><b>采购单号</b>(行级)= 合单**前**的采购订单号 —— 合单后唯一能认出"这行原属哪张订单"的键,
     *       逐站带下去(暂收→检验→退回/入库),转ERP 作行级 {@code src_bill_no};</li>
     *   <li><b>采购订单行号</b> = 合单**前**来源订单上的行号,照旧由 detailMap 的 行号→采购订单行号 带下,
     *       转ERP 作 {@code src_seq};</li>
     *   <li><b>暂收单自己的行 id / form_flow_link.source_line_key</b>({@code 暂收单号#行id})= 合单**后**
     *       的行标识,占用与反查一律走它 —— 本方法按保存顺序回查目标行 id 建占用,口径与原分批生单一致。</li>
     * </ul>
     *
     * <p>校验:每张来源单都必须**已审核**、且有本次勾选的行;所有来源单的**供应商必须相同**
     * (用户口径「选择同一供应商的单据」)—— 不同供应商直接拒绝,并点名是哪两张单不一致。
     *
     * @param docs 每张来源单一条:{@code sourceNo, lines:[{lineKey, qty, 仓库/仓位...}]}
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateMerged(String sourcePanel, String action,
                                              List<Map<String, Object>> docs, String batchNoOverride,
                                              String user) {
        String target = pushTarget(sourcePanel, action);
        if (target == null) throw new IllegalStateException("该动作没有可用的生单目标:" + action);
        if (!isBatchTarget(target)) {
            throw new IllegalStateException("合单生单只支持分批链路(目标面板表头有「批次号」):" + target);
        }
        if (docs == null || docs.size() < 2) throw new IllegalStateException("合单生单至少要选两张来源单据");

        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        PanelRegistry.PanelDef tgtDef = registry.panel(target);
        Map<String, Object> maps = configService.flowMaps(sourcePanel, target);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + target);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");
        String tgtQtyLabel = qtyLabelOf(tgtDef, "detail");
        boolean rowHasBatch = detailHas(tgtDef, "批次号");
        boolean rowHasPoNo = detailHas(tgtDef, "采购单号");

        double ratio = batchService.overRatio();
        // 头:供应商必须全同;其余头字段取第一张单(日期一律当天)
        Map<String, Object> firstHead = null;
        String supplier = "";
        String supplierCode = "";
        List<String> orderNos = new ArrayList<>();
        // 勾选行收集(顺序 = 文档顺序 × 行顺序;最终 targetItems 与 links 共用这一份顺序)
        record Pick(String sourceNo, Map<String, Object> item, Map<String, Object> row,
                    double qty, String lineKey) { }
        List<Pick> picks = new ArrayList<>();

        // ── 第一轮:**先**把所有来源单的状态与供应商核完(业务规则优先于数量校验)──
        // 用户口径「可以选择同一供应商的单据」——混了别的供应商要第一句就说清,而不是先报某行超量。
        Map<String, Map<String, Object>> srcOf = new LinkedHashMap<>();
        for (Map<String, Object> doc : docs) {
            String no = str(doc.get("sourceNo"));
            if (no.isEmpty()) continue;
            String status = str(buttonService.docStatus(sourcePanel, no).get("status"));
            if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可生单:" + no + "(当前 " + status + ")");
            Map<String, Object> src = queryService.loadOneDoc(srcDef, no);
            if (src == null || src.isEmpty()) throw new IllegalStateException("来源单据不存在:" + no);
            Map<String, Object> head = new LinkedHashMap<>(src);
            head.remove("detail");
            if (firstHead == null) firstHead = head;
            String sup = str(head.get("供应商"));
            String supCode = str(head.get("供应商编码"));
            if (supplier.isEmpty()) { supplier = sup; supplierCode = supCode; }
            else if (!supplier.equals(sup)) {
                throw new IllegalStateException("合单生单只允许**同一供应商**的单据:" + orderNos.get(0)
                        + " 是「" + supplier + "」," + no + " 是「" + sup + "」");
            }
            orderNos.add(no);
            srcOf.put(no, src);
        }
        if (orderNos.size() < 2) throw new IllegalStateException("合单生单至少要两张来源单据");

        // ── 第二轮:逐单逐行取本次送料量并校验上限 ──
        for (Map<String, Object> doc : docs) {
            String no = str(doc.get("sourceNo"));
            if (no.isEmpty()) continue;
            Map<String, Object> src = srcOf.get(no);

            Map<String, Double> qtyByLine = new LinkedHashMap<>();
            Object rawLines = doc.get("lines");
            if (rawLines instanceof List<?> lineList) {
                for (Object lo : lineList) {
                    if (!(lo instanceof Map<?, ?> lm)) continue;
                    String key = str(lm.get("lineKey"));
                    if (key.isEmpty()) continue;
                    qtyByLine.put(key, lm.get("qty") == null ? 0d : numOf(lm.get("qty")));
                }
            }
            if (qtyByLine.isEmpty()) throw new IllegalStateException("合单生单的来源单没有勾选行:" + no);

            // 候选行与单张分批生单同一份口径(batchRows),逐行校验可送上限
            List<Map<String, Object>> srcItems = new ArrayList<>(itemsOf(src));
            if (srcItems.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生单:" + no);
            Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
            for (Map<String, Object> r : batchRows(sourcePanel, no, srcItems,
                    batchService.sentByLineKey(sourcePanel, no), batchService.returnedByOrderLine(no), ratio)) {
                byKey.put(str(r.get("lineKey")), r);
            }
            for (Map.Entry<String, Double> e : qtyByLine.entrySet()) {
                String lineKey = e.getKey();
                double qty = e.getValue() == null ? 0d : e.getValue();
                if (qty <= 0.000001) continue;
                Map<String, Object> r = byKey.get(lineKey);
                if (r == null) throw new IllegalStateException("送料行不存在或已失效:" + lineKey);
                Map<String, Object> item = sourceItemOf(srcItems, orderKeyOf(lineKey));
                if (item == null) throw new IllegalStateException("送料行对应的来源明细已不存在:" + lineKey);
                double cap = isIsolatedKey(lineKey) ? numOf(r.get("剩余数量")) : numOf(r.get("可送上限"));
                if (qty > cap + 0.000001) {
                    // 行号可能为空(部分面板明细没 seq),别把提示写成「第 null 行」
                    String label = str(r.get("行号")).isBlank()
                            ? "物料 " + str(item.get("物料编码")) + " 这一行" : "第 " + r.get("行号") + " 行";
                    throw new IllegalStateException(no + " " + label + "本次送料量 " + round2(qty)
                            + " 超出允许上限 " + round2(cap));
                }
                picks.add(new Pick(no, item, r, qty, lineKey));
            }
        }
        if (picks.size() < 1) throw new IllegalStateException("合单生单没有可送的行");
        if (supplier.isEmpty() && supplierCode.isEmpty()) {
            throw new IllegalStateException("来源单据没有供应商,不能合单生单");
        }

        // —— 目标单头(一张)——
        Map<String, Object> targetHead = new LinkedHashMap<>();
        if (firstHead != null) {
            for (Map<String, String> m : headerMap) {
                Object v = firstHead.get(m.get("from"));
                if (v != null) targetHead.put(m.get("to"), v);
            }
        }
        setIfRegistered(targetHead, tgtDef, "header", "供应商", supplier);
        // 暂收单头的供应商编码字段叫「供应商代码」(其余面板叫「供应商编码」)—— 两个名字都试,谁注册写谁
        setIfRegistered(targetHead, tgtDef, "header", "供应商代码", supplierCode);
        setIfRegistered(targetHead, tgtDef, "header", "供应商编码", supplierCode);
        // 合单后表头「采购订单号」放**全部订单号**(给人看);真正的行级归属看每行的「采购单号」。
        setIfRegistered(targetHead, tgtDef, "header", "采购订单号", String.join("、", orderNos));
        targetHead.put(colLabel(tgtDef, "来源单据", "来源单据"), srcDef.name() + "(合单)");
        targetHead.put(colLabel(tgtDef, "来源单号", "来源单号"), String.join("、", orderNos));
        String dateLabel = "单据日期";
        if (tgtDef.dateCol() != null && !tgtDef.dateCol().isBlank()) {
            PanelRegistry.FieldDef df = tgtDef.byCol(tgtDef.dateCol());
            if (df != null) dateLabel = df.label();
        }
        targetHead.put(dateLabel, java.time.LocalDate.now().toString());

        // —— 批次号/批次台账:一张合单 = 一个号 ——
        String batchNo;
        String manual = str(batchNoOverride);
        if (manual.length() > BATCH_NO_MAX) {
            throw new IllegalArgumentException("批次号过长(最多 " + BATCH_NO_MAX + " 个字符):" + manual);
        }
        batchNo = manual.isEmpty() ? BatchService.buildBatchNo(java.time.LocalDate.now()) : manual;
        int batchId = batchService.createBatch(sourcePanel, orderNos.get(0), target, batchNo, user);
        targetHead.put("批次键", batchId);
        setIfRegistered(targetHead, tgtDef, "header", "批次号", batchNo);

        // —— 目标行:N 张单的行并进同一张,逐行记住「采购单号(合单前订单号)」——
        List<Map<String, Object>> targetItems = new ArrayList<>();
        List<Pick> rowPick = new ArrayList<>();      // targetItems 下标 ↔ Pick(占用建 link 用)
        for (Pick p : picks) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = p.item().get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            row.put(tgtQtyLabel, round2(p.qty()));
            if (rowHasBatch) row.put("批次号", batchNo);
            // ★ 合单**前**的订单号(行级):合单后一行一个号,不能靠表头
            if (rowHasPoNo) row.put("采购单号", p.sourceNo());
            applySourceFlags(sourcePanel, target, p.item(), row);
            Map<String, Object> whBin = whBinCacheOf(docs, p.sourceNo(), p.lineKey());
            applyWhBin(row, whBin.isEmpty() ? null : whBin, tgtDef);
            targetItems.add(row);
            rowPick.add(p);
        }

        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", targetItems));
        Map<String, Object> saved = buttonService.save(tgtDef, formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        // —— 占用(行级):按保存顺序取目标行 id,与 rowPick 一一对应 ——
        List<Integer> tgtIds = jdbc.queryForList("SELECT id FROM " + tgtDef.lineTable()
                        + " WHERE [" + tgtDef.groupCol() + "] = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id",
                Integer.class, newNo);
        Map<String, List<VoucherFlowService.BatchLine>> linksBySource = new LinkedHashMap<>();
        double sum = 0;
        for (int i = 0; i < rowPick.size(); i++) {
            Pick p = rowPick.get(i);
            if (p.qty() <= 0) continue;
            sum += p.qty();
            Integer tgtId = i < tgtIds.size() ? tgtIds.get(i) : null;
            linksBySource.computeIfAbsent(p.sourceNo(), k -> new ArrayList<>()).add(new VoucherFlowService.BatchLine(
                    p.lineKey(),
                    tgtId == null ? null : newNo + "#" + tgtId,
                    p.item().get("物料编码") == null ? null : String.valueOf(p.item().get("物料编码")),
                    numOf(p.row() == null ? p.item().get("数量") : p.row().get("数量")), p.qty()));
        }
        for (Map.Entry<String, List<VoucherFlowService.BatchLine>> e : linksBySource.entrySet()) {
            voucherFlow.linkBatch(sourcePanel, e.getKey(), target, newNo, null, batchId, e.getValue());
        }
        jdbc.update("UPDATE form_flow_link SET batch_no = ? WHERE batch_id = ? AND ISNULL(batch_no, N'') = N''",
                batchNo, batchId);
        batchService.bind(batchId, target, newNo, round2(sum));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("批次号", batchNo);
        out.put("批次键", batchId);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", target);
        out.put("本次送料合计", round2(sum));
        out.put("合单来源", orderNos);
        out.put("合单行数", rowPick.size());
        return out;
    }

    /**
     * 合单生单里某行的仓库/仓位预填:从该来源单的 lines 里按 lineKey 取回
     * (合单是"按单据 × 行"两组循环,预填值挂在原始请求体上,不在 picked 里)。
     */
    private Map<String, Object> whBinCacheOf(List<Map<String, Object>> docs, String sourceNo, String lineKey) {
        for (Map<String, Object> doc : docs) {
            if (!sourceNo.equals(str(doc.get("sourceNo")))) continue;
            Object rawLines = doc.get("lines");
            if (!(rawLines instanceof List<?> list)) return Map.of();
            for (Object lo : list) {
                if (!(lo instanceof Map<?, ?> lm)) continue;
                if (!lineKey.equals(str(lm.get("lineKey")))) continue;
                Map<String, Object> out = new LinkedHashMap<>();
                for (String k : WHBIN_KEYS) {
                    Object v = lm.get(k);
                    if (v != null && !String.valueOf(v).isBlank()) out.put(k, v);
                }
                return out;
            }
        }
        return Map.of();
    }
}
