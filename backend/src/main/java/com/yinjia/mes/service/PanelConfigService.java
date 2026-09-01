package com.yinjia.mes.service;

import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 面板配置生成器:以 yj_panel/yj_field 元数据生成 light-mes 面板配置 JSON。
 * 生成的结构完全对齐 light-mes 前端契约(metadata/panelPageDto/dataSchema/detail)。
 *
 * 多语言(ADR-0001):dataName/panelState/buttonName 等数据键保持中文不变;
 * 显示名(displayName/columnAliases/panelName/页签名)按请求 locale(Accept-Language,
 * 经 Spring LocaleContextHolder 解析)选择 label_en/panel_name_en,缺省回退中文。
 */
@Service
public class PanelConfigService {

    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;
    private final TranslationService translations;

    public PanelConfigService(PanelRegistry registry, JdbcTemplate jdbc, TranslationService translations) {
        this.registry = registry;
        this.jdbc = jdbc;
        this.translations = translations;
    }

    /** 当前请求的目标语言键(en/ja/ko/...;zh 系=zh)。 */
    private static String localeKey() {
        return TranslationService.localeKey(LocaleContextHolder.getLocale());
    }

    /** 当前请求是否要求非中文界面。 */
    private static boolean isForeign() {
        String key = localeKey();
        return !"zh".equals(key);
    }

    /** 字段标签译名(中文原文→当前语言)。 */
    private Map<String, String> fieldDict() {
        return isForeign() ? translations.scope(localeKey(), "field") : Map.of();
    }

    /** 面板名译名。 */
    private Map<String, String> panelDict() {
        return isForeign() ? translations.scope(localeKey(), "panel") : Map.of();
    }

    // ---------- 配置生成 ----------

    public Map<String, Object> getPanelConfig(String panelCode) {
        return buildConfig(registry.panel(panelCode));
    }

    public Map<String, Object> buildConfig(PanelRegistry.PanelDef def) {
        if ("archive".equals(def.mode())) return buildArchiveConfig(def);
        return buildDocConfig(def);
    }

    /**
     * 基础档案:严格 light-mes「单单据面板」结构(docs/frontend/前端面板设计.md §八,基准 DEPT):
     * queryFields=[],dataSchema 仅"备注",全部业务字段在 detail.tabs 单页签,
     * gridTabs=面板名+"明细" / rowSource=rows,panelState=状态(启用/已作废)。
     */
    private Map<String, Object> buildArchiveConfig(PanelRegistry.PanelDef def) {
        boolean foreign = isForeign();
        String panelDisplay = foreign ? panelDict().getOrDefault(def.name(), def.name()) : def.name();
        String tabLabel = panelDisplay + (foreign ? " Details" : "明细");
        String tabKey = def.tabKey();

        List<Map<String, Object>> detailFields = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fields()) {
            Map<String, Object> spec = fieldSpec(def, f);
            spec.put("isRequired", f.required());
            detailFields.add(spec);
        }
        Map<String, Object> gridInfo = buildGridColumns(def.fields());

        List<Map<String, Object>> buttonGroups = new ArrayList<>();
        buttonGroups.add(group("新增", List.of("新增")));
        buttonGroups.add(group("修改", List.of("修改")));
        buttonGroups.add(group("保存", List.of("保存", "保存新增")));
        buttonGroups.add(group("删除", List.of("删除", "删除单据")));
        buttonGroups.add(group("查找", List.of("查找", "刷新")));
        buttonGroups.add(group("打印", List.of("打印", "预览")));
        buttonGroups.add(group("导入", List.of("下载模板", "导入")));
        buttonGroups.add(group("更多", List.of("复制", "表格调整", "导出", "退出")));

        List<Map<String, Object>> panelButtons = new ArrayList<>();
        for (String b : List.of("新增流程", "删除", "刷新", "保存", "放弃")) {
            panelButtons.add(Map.of("buttonName", b));
        }

        Map<String, Object> gridTab = new LinkedHashMap<>();
        gridTab.put("label", tabLabel);
        gridTab.put("rowSource", "rows");
        gridTab.put("columns", gridInfo.get("columns"));
        if (!((Map<?, ?>) gridInfo.get("columnAliases")).isEmpty()) {
            gridTab.put("columnAliases", gridInfo.get("columnAliases"));
            gridTab.put("displayToKey", gridInfo.get("displayToKey"));
        }

        Map<String, Object> tablePage = new LinkedHashMap<>();
        tablePage.put("tableName", panelDisplay + (foreign ? " List" : "列表"));
        tablePage.put("queryFields", List.of());
        tablePage.put("gridTabs", List.of(gridTab));
        tablePage.put("topBarBtn", List.of(
                Map.of("buttonName", "新增流程"), Map.of("buttonName", "删除"), Map.of("buttonName", "刷新")));
        tablePage.put("rowOperationBarBtn", List.of());
        tablePage.put("events", List.of());

        Map<String, Object> formPage = new LinkedHashMap<>();
        formPage.put("formName", panelDisplay);
        formPage.put("fieldNames", "备注");
        formPage.put("bottomOperationBarBtn", List.of(
                Map.of("buttonName", "保存"), Map.of("buttonName", "删除"), Map.of("buttonName", "放弃")));
        formPage.put("events", List.of());

        Map<String, Object> pageDto = new LinkedHashMap<>();
        pageDto.put("formPages", List.of(formPage));
        pageDto.put("tablePages", List.of(tablePage));

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("panelCode", def.code());
        metadata.put("panelName", panelDisplay);
        metadata.put("panelCategory", def.category());
        metadata.put("singleDoc", true);
        metadata.put("panelState", Map.of(
                "dataName", "状态",
                "dataType", "STRING",
                "defaultOptions", List.of("启用", "已作废")));
        metadata.put("panelButtons", panelButtons);
        metadata.put("buttonGroups", buttonGroups);
        metadata.put("panelPageDto", pageDto);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metadata", metadata);
        // dataSchema 仅"备注"(单单据规范:业务数据全部位于明细页签)
        out.put("dataSchema", Map.of("fields", List.of(remarkField())));
        Map<String, Object> detail = new LinkedHashMap<>();
        Map<String, Object> tab = new LinkedHashMap<>();
        tab.put("key", tabKey);
        tab.put("label", tabLabel);
        tab.put("fields", detailFields);
        tab.put("isRequired", false);
        detail.put("tabs", List.of(tab));
        out.put("detail", detail);
        return out;
    }

    private Map<String, Object> remarkField() {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("dataName", "备注");
        f.put("dataType", "文本");
        return f;
    }

    /** 单据/平表面板配置(与 light-mes 单据结构一致) */
    private Map<String, Object> buildDocConfig(PanelRegistry.PanelDef def) {
        boolean doc = def.isDoc();
        boolean flat = "flat".equals(def.mode());
        boolean foreign = isForeign();
        String panelDisplay = foreign ? panelDict().getOrDefault(def.name(), def.name()) : def.name();
        Map<String, String> fixed = foreign ? translations.translate(localeKey(), List.of("明细", "列表", "汇总")) : Map.of();
        String detailLabel = foreign ? fixed.getOrDefault("明细", "Details") : "明细";
        String listSuffix = foreign ? " " + fixed.getOrDefault("列表", "List") : "列表";
        String summaryLabel = foreign ? fixed.getOrDefault("汇总", "Summary") : "汇总";

        // 查询字段
        List<Map<String, Object>> queryFields = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("query")) {
            queryFields.add(fieldSpec(def, f));
        }
        // 表头字段(dataSchema)
        List<Map<String, Object>> headerFields = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            Map<String, Object> spec = fieldSpec(def, f);
            spec.put("isRequired", f.required());
            headerFields.add(spec);
        }
        // 明细字段(detail.tabs + gridTabs)
        List<Map<String, Object>> detailFields = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("detail")) {
            Map<String, Object> spec = fieldSpec(def, f);
            spec.put("isRequired", f.required());
            detailFields.add(spec);
        }
        // 平表模式:全部字段直接作为网格列
        List<Map<String, Object>> gridFields = flat
                ? def.fields().stream().map(f -> fieldSpec(def, f)).toList() : detailFields;

        // 工具栏按钮组:PANDA 一比一(单据=PANDA_BUTTONS 按面板复刻;报表=查询/打印/更多)。
        // - 查询组动作(查询/查找)由前端 toolbarGroups 剥除并与独立「查询」按钮去重——查询方案保留;
        // - 「更多」组保留 表格调整(列自定义);
        // - 审核+审批 双组经前端 normalizeApprovalGroups 归一为一个审批组(动作并集);
        // - 无 PANDA 基准的面板(旧单据/派工等)维持原 light-mes 组。
        List<String> flatButtons = flat ? List.<String>of()
                : doc ? List.of("新增流程", "删除", "刷新")
                : List.of("新增", "保存", "删除", "刷新");
        List<Map<String, Object>> buttonGroups = new ArrayList<>();
        List<String[]> panda = PANDA_BUTTONS.get(def.code());
        // 灰色占位动作(选单无流转来源 / 生单无已实现链路)——前端 isDisabled 据此恒置灰
        List<String> disabledActions = new ArrayList<>();
        if (flat) {
            // 报表(明细/统计表)统一:查询|查询,刷新 + 打印|打印,预览,导出 + 更多|发送邮件,表格调整,退出
            buttonGroups.add(group("查询", List.of("查询", "刷新")));
            buttonGroups.add(group("打印", List.of("打印", "预览", "导出")));
            buttonGroups.add(group("更多", List.of("发送邮件", "表格调整", "退出")));
        } else if (doc && panda != null) {
            for (String[] g : panda) {
                buttonGroups.add(group(g[0], List.of(g).subList(1, g.length)));
                if ("选单".equals(g[0]) && !SELECT_FLOWS.containsKey(def.code())) {
                    disabledActions.addAll(List.of(g).subList(1, g.length));
                }
                if ("生单".equals(g[0])) {
                    for (int i = 1; i < g.length; i++) {
                        if (pushTarget(def.code(), g[i]) == null) disabledActions.add(g[i]);
                    }
                }
            }
        } else {
            // 无 PANDA 基准(旧单据/派工等):同样遵守 选单在新增后 / 生单在审核后 的固定位置
            buttonGroups.add(group("新增", List.of("新增")));
            if (SELECT_FLOWS.containsKey(def.code())) {
                buttonGroups.add(group("选单", List.of("选单")));
            } else {
                buttonGroups.add(group("选单", List.of("选单")));
                disabledActions.add("选单");
            }
            buttonGroups.add(group("保存", List.of("保存")));
            buttonGroups.add(group("删除", List.of("删除")));
            if (doc) buttonGroups.add(group("审批", List.of("审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审")));
            buttonGroups.add(group("生单", List.of("生单")));
            disabledActions.add("生单");
            buttonGroups.add(group("刷新", List.of("刷新")));
            buttonGroups.add(group("更多", List.of("复制", "表格调整", "导出", "退出")));
        }

        List<Map<String, Object>> panelButtons = new ArrayList<>();
        for (String b : flatButtons) panelButtons.add(Map.of("buttonName", b));

        // gridTabs:明细列(按 visible 过滤 + alias 别名)
        List<PanelRegistry.FieldDef> gridFieldDefs = flat ? def.fields() : def.fieldsAt("detail");
        Map<String, Object> gridInfo = buildGridColumns(gridFieldDefs);
        List<Map<String, Object>> gridTabs = new ArrayList<>();
        Map<String, Object> main = new LinkedHashMap<>();
        main.put("label", flat ? panelDisplay : detailLabel);
        main.put("rowSource", "items");
        main.put("columns", gridInfo.get("columns"));
        if (!((Map<?, ?>) gridInfo.get("columnAliases")).isEmpty()) {
            main.put("columnAliases", gridInfo.get("columnAliases"));
            main.put("displayToKey", gridInfo.get("displayToKey"));
        }
        gridTabs.add(main);

        // 汇总页签(对齐 PANDA 双层契约之一:gridTabs 第二项 summary=true)。
        // 列表页出现 明细|汇总 页签切换:前端按 存货/产品/材料 分组,数量金额列合计,尾行总计。
        List<PanelRegistry.FieldDef> measureFields = doc ? measuresOf(gridFieldDefs) : List.of();
        if (!measureFields.isEmpty()) {
            Map<String, Object> sum = new LinkedHashMap<>();
            sum.put("label", summaryLabel);
            sum.put("rowSource", "items");
            sum.put("summary", true);
            sum.put("columns", summaryColumns(gridFieldDefs));
            gridTabs.add(sum);
        }

        Map<String, Object> tablePage = new LinkedHashMap<>();
        tablePage.put("tableName", panelDisplay + listSuffix);
        if (def.pageSize() != null) tablePage.put("pageSize", def.pageSize());
        tablePage.put("queryFields", queryFields);
        tablePage.put("gridTabs", gridTabs);
        tablePage.put("topBarBtn", panelButtons);
        tablePage.put("rowOperationBarBtn", List.of());
        tablePage.put("events", List.of());

        Map<String, Object> pageDto = new LinkedHashMap<>();
        pageDto.put("tablePages", List.of(tablePage));

        Map<String, Object> formPage = new LinkedHashMap<>();
        formPage.put("formName", panelDisplay);
        formPage.put("fieldNames", String.join(",", headerFields.stream().map(f -> String.valueOf(f.get("dataName"))).toList()));
        // 表单底部:PANDA bottomOperationBarBtn 一比一(保存,删除,审核,弃审,+中止类,+放弃);
        // 无 PANDA 基准的沿用 panelButtons+放弃
        List<Map<String, Object>> formButtons;
        if (flat) {
            formButtons = new ArrayList<>();
        } else if (doc && PANDA_BUTTONS.containsKey(def.code())) {
            formButtons = new ArrayList<>();
            for (String b : FORM_BOTTOM.getOrDefault(def.code(), FORM_BOTTOM_DEFAULT)) {
                formButtons.add(Map.of("buttonName", b));
            }
        } else {
            formButtons = new ArrayList<>(panelButtons);
            formButtons.add(Map.of("buttonName", "放弃"));
        }
        formPage.put("bottomOperationBarBtn", formButtons);
        formPage.put("events", List.of());

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("panelCode", def.code());
        metadata.put("panelName", panelDisplay);
        metadata.put("panelCategory", def.category());
        metadata.put("singleDoc", false);
        metadata.put("autoCodeField", doc ? autoCodeLabel(def) : null);
        metadata.put("panelState", Map.of(
                "dataName", "单据状态",
                "dataType", "STRING",
                "defaultOptions", List.of("草稿", "已审核", "审批中", "已中止", "已作废")));
        metadata.put("panelButtons", panelButtons);
        metadata.put("buttonGroups", buttonGroups);
        // 灰色占位动作(选单无来源/生单无实现链路):前端恒置灰,布局与 T+ 一致
        if (!disabledActions.isEmpty()) metadata.put("disabledActions", disabledActions);
        metadata.put("panelPageDto", pageDto);
        metadata.put("formPages", List.of(formPage));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metadata", metadata);
        // 选单配置(对齐 T+ SelectVoucher:来源面板/查询字段/列/头行映射全自动生成)
        Map<String, Object> selectConfig = buildSelectConfig(def);
        if (selectConfig != null) out.put("selectConfig", selectConfig);
        out.put("dataSchema", Map.of("fields", headerFields));
        Map<String, Object> detail = new LinkedHashMap<>();
        Map<String, Object> tab = new LinkedHashMap<>();
        tab.put("key", "items");
        tab.put("label", detailLabel);
        tab.put("fields", detailFields);
        // 自动计算规则(引擎 calculateDetailRow 消费:参照带回与保存时重算)
        List<Map<String, Object>> calcRules = buildCalcRules(def.fieldsAt("detail"));
        if (!calcRules.isEmpty()) tab.put("calc", calcRules);
        // 汇总字段(对齐 PANDA 双层契约之二:detail.tabs[].summaryItems,如 数量合计/金额合计)。
        // 列表页汇总视图据此合计列全集(补齐前端 KNOWN_NUM 未覆盖的 销售金额/折扣金额 等);
        // 表单页明细区出现「明细汇总」子页签(汇总项目/数值 对照,PANDA PxService 同款)。
        if (!measureFields.isEmpty()) {
            List<Map<String, Object>> summaryItems = new ArrayList<>();
            for (PanelRegistry.FieldDef f : measureFields) {
                summaryItems.add(Map.of("label", f.label() + "合计", "field", f.label()));
            }
            tab.put("summaryItems", summaryItems);
        }
        detail.put("tabs", List.of(tab));
        out.put("detail", detail);
        return out;
    }

    /** 数值型判定(yj_field.data_type:小数/整数/数值)。 */
    private static boolean isNumericType(String dataType) {
        if (dataType == null) return false;
        String t = dataType;
        return t.contains("小数") || t.contains("整数") || t.contains("数值");
    }

    /**
     * 汇总度量字段(参与合计的数量/金额类数值列)。
     * 取数值型且名称含 数量/金额/税额/总重 的字段——排除 单价/税率%/换算率/现存量 等
     * 加总无业务意义的数值列(对齐 PANDA summaryItems 只配 数量合计/金额合计/含税金额合计)。
     */
    private static final java.util.regex.Pattern MEASURE_LABEL =
            java.util.regex.Pattern.compile("数量|金额|税额|总重");

    private static List<PanelRegistry.FieldDef> measuresOf(List<PanelRegistry.FieldDef> fields) {
        List<PanelRegistry.FieldDef> out = new ArrayList<>();
        for (PanelRegistry.FieldDef f : fields) {
            if (f.hidden() || !f.visible()) continue;
            if (isNumericType(f.dataType()) && MEASURE_LABEL.matcher(f.label()).find()) out.add(f);
        }
        return out;
    }

    /** 汇总页签列(PANDA 契约:维度列 + 分组键 + 规格单位 + 数值列;前端汇总视图按主明细列展示)。 */
    private static List<String> summaryColumns(List<PanelRegistry.FieldDef> fields) {
        java.util.Set<String> labels = new java.util.HashSet<>();
        for (PanelRegistry.FieldDef f : fields) labels.add(f.label());
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        for (String d : List.of("仓库", "加工单号", "项目")) if (labels.contains(d)) out.add(d);
        for (String k : List.of("存货编码", "产品编码", "材料编码", "存货名称", "产品名称", "材料名称", "工序编码", "工序名称")) {
            if (labels.contains(k)) out.add(k);
        }
        for (String u : List.of("规格型号", "计量单位", "单位", "采购单位", "销售单位", "生产单位")) {
            if (labels.contains(u)) out.add(u);
        }
        for (PanelRegistry.FieldDef f : fields) {
            if (!f.visible()) continue;
            if (isNumericType(f.dataType())) out.add(f.label());
        }
        return new ArrayList<>(out);
    }

    /** 明细自动计算规则:按字段组合推导常见公式(字段名=行键,引擎按中文名取值求值)。 */
    private List<Map<String, Object>> buildCalcRules(List<PanelRegistry.FieldDef> detailFields) {
        java.util.Set<String> labels = new java.util.HashSet<>();
        for (PanelRegistry.FieldDef f : detailFields) labels.add(f.label());
        List<Map<String, Object>> out = new ArrayList<>();
        String qty = labels.contains("数量") ? "数量" : labels.contains("实收数量") ? "实收数量" : null;
        boolean hasPrice = labels.contains("单价");
        if (qty != null && hasPrice && labels.contains("金额")) calcRule(out, "金额", qty + "*单价", 2);
        if (hasPrice && labels.contains("税率%") && labels.contains("含税单价")) calcRule(out, "含税单价", "单价*(1+税率%/100)", 4);
        if (qty != null && labels.contains("含税单价") && labels.contains("含税金额")) calcRule(out, "含税金额", qty + "*含税单价", 2);
        if (labels.contains("金额") && labels.contains("税率%") && labels.contains("税额")) calcRule(out, "税额", "金额*税率%/100", 2);
        if (qty != null && hasPrice && labels.contains("折扣%") && labels.contains("折扣金额")) calcRule(out, "折扣金额", qty + "*单价*折扣%/100", 2);
        if (qty != null && labels.contains("单重") && labels.contains("总重")) calcRule(out, "总重", "单重*" + qty, 4);
        return out;
    }

    private void calcRule(List<Map<String, Object>> out, String target, String formula, int round) {
        out.add(Map.of("target", target, "formula", formula, "round", round));
    }

    /** 单号字段标签(供 autoCodeField 展示) */
    private String autoCodeLabel(PanelRegistry.PanelDef def) {
        PanelRegistry.FieldDef g = def.byCol(def.groupCol());
        return g == null ? "单据编号" : g.label();
    }

    private Map<String, Object> group(String name, List<String> actions) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("actions", actions);
        return m;
    }

    /** 单个字段规格:dataName 为字段键(对齐 light-mes 中文键契约,永不随语言变化);
     *  displayName 为显示名,按 locale 从翻译表选择(别名 > 译名 > 原标签)。 */
    private Map<String, Object> fieldSpec(PanelRegistry.PanelDef def, PanelRegistry.FieldDef f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("dataName", f.label());
        m.put("dataType", f.dataType());
        boolean foreign = isForeign();
        String display = foreign
                ? (f.alias() != null && !f.alias().isBlank() ? f.alias() : fieldDict().getOrDefault(f.label(), f.label()))
                : f.displayName();
        if (!display.equals(f.label())) m.put("displayName", display);
        if (f.width() != null) m.put("width", f.width());
        if (f.hidden()) m.put("hidden", true);
        if (!f.editable()) m.put("readonly", true);
        if ("下拉框".equals(f.dataType()) && f.dictSql() != null) {
            m.put("options", dictOptions(f.dictSql()));
        }
        if (f.isRef()) {
            m.put("refPanel", f.refPanel());
            m.put("refField", refLabelOf(f.refPanel(), f.refField()));
            m.put("displayField", refLabelOf(f.refPanel(), f.displayField()));
            List<Map<String, String>> refMap = buildRefMap(def, f);
            if (!refMap.isEmpty()) m.put("refMap", refMap);
        }
        return m;
    }

    /** 参照带回映射(对齐 light-mes ref.map 契约):
     *  1) 同名字段自动映射;2) 同义词映射(引用面板字段 → 本面板异名字段)。
     *  参照弹窗选中后整串回填——如选存货同时带出 存货编码/规格型号/单位/单价 等。 */
    private List<Map<String, String>> buildRefMap(PanelRegistry.PanelDef def, PanelRegistry.FieldDef f) {
        List<Map<String, String>> out = new ArrayList<>();
        if (def == null || f.refPanel() == null) return out;
        try {
            PanelRegistry.PanelDef refDef = registry.panel(f.refPanel());
            java.util.Set<String> mapped = new java.util.HashSet<>();
            for (PanelRegistry.FieldDef sibling : def.fields()) {
                if (sibling.label().equals(f.label())) continue;
                if (refDef.byLabel(sibling.label()) != null) {
                    out.add(Map.of("from", sibling.label(), "to", sibling.label()));
                    mapped.add(sibling.label());
                }
            }
            // 同义词:引用面板字段名 → 本面板可能的异名字段名(如 存货的"计量单位"→单据的"销售单位/单位/采购单位")
            for (Map.Entry<String, List<String>> e : REF_SYNONYMS.entrySet()) {
                if (refDef.byLabel(e.getKey()) == null) continue;
                for (String target : e.getValue()) {
                    if (mapped.contains(target) || def.byLabel(target) == null) continue;
                    out.add(Map.of("from", e.getKey(), "to", target));
                    mapped.add(target);
                }
            }
        } catch (Exception ignore) { /* 引用面板不存在时静默跳过 */ }
        return out;
    }

    /** 参照带回同义词词典(引用面板字段 → 本面板异名字段候选,命中即映射)。
     *  选存货整串带回:编码/名称的 材料/产品/物料 异名口径 + 各单位口径 + 参考成本→单价。 */
    private static final Map<String, List<String>> REF_SYNONYMS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "计量单位", List.of("单位", "销售单位", "采购单位", "生产单位"),
            "参考成本", List.of("单价"),
            "存货编码", List.of("材料编码", "产品编码", "物料编码"),
            "存货名称", List.of("材料名称", "产品名称", "物料名称")
    )));

    /** 委外三单共用按钮组骨架(选单来源各自不同,见下方三常量)。 */
    private static final List<String[]> OUTSOURCE_BASE = List.of(
            new String[]{"新增", "新增"},
            new String[]{"保存", "保存", "保存新增", "保存为草稿"},
            new String[]{"删除", "删除", "删除单据"},
            new String[]{"审核", "审核", "弃审", "审批情况", "提交审批", "审批通过", "审批驳回"},
            new String[]{"打印", "打印", "预览", "导出"},
            new String[]{"更多", "复制", "导出", "表格调整", "退出"});

    /** 生单组插入位(固定在审核组之后):[审核, 生单, 打印, ...] */
    private static List<String[]> withGenerate(List<String[]> base, String... actions) {
        List<String[]> out = new ArrayList<>(base);
        int at = 0;
        for (int i = 0; i < out.size(); i++) {
            if ("审核".equals(out.get(i)[0]) || "审批".equals(out.get(i)[0])) { at = i + 1; break; }
        }
        out.add(at, buttonGroup("生单", actions));
        return List.copyOf(out);
    }

    /** 组数组构造:[组名, 动作...] */
    private static String[] buttonGroup(String name, String... actions) {
        String[] g = new String[1 + actions.length];
        g[0] = name;
        System.arraycopy(actions, 0, g, 1, actions.length);
        return g;
    }

    /** 委外三单:新增|选单|保存|删除|审核|生单(灰)|打印|更多 */
    private static List<String[]> outsourceGroups(String... selectActions) {
        List<String[]> out = new ArrayList<>(OUTSOURCE_BASE);
        out.add(1, buttonGroup("选单", selectActions));
        return withGenerate(out, "生单");
    }

    private static final List<String[]> OUTSOURCE_GROUPS_IN = outsourceGroups("选单", "选委外加工单");
    private static final List<String[]> OUTSOURCE_GROUPS_ISSUE = outsourceGroups("选单", "选委外加工单");
    private static final List<String[]> OUTSOURCE_GROUPS_ORDER = withGenerate(
            new ArrayList<>(List.of(new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选销售订单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审", "审批情况", "提交审批", "审批通过", "审批驳回"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "导出", "表格调整", "退出"})),
            "生成委外发料单");

    /**
     * 单据面板工具栏按钮组(PANDA 复刻 + 固定位于约定,2026-09-01 用户约定):
     * - 选单组固定在「新增」之后;生单组固定在「审核/审批」之后;每个单据面板两组必备,
     *   无对应流转/生单逻辑的输出灰色占位(metadata.disabledActions,前端恒置灰不可点);
     * - 占位动作名优先取 PANDA 该面板生单组首个动作(如 生成进货单/生成销货单),PANDA
     *   无生单组的面板用通用「生单」;
     * - 可执行动作与 PANDA 一致(保存/删除/审批/打印/查找/导入/更多含表格调整);
     *   审核+审批 双组由前端 normalizeApprovalGroups 归一为一个审批组(动作并集)。
     */
    private static final Map<String, List<String[]>> PANDA_BUTTONS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.ofEntries(
            // 销售订单:选单灰(无上游);生单=生产加工单/销售出库单(已实现)
            java.util.Map.entry("SO_ORDER", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审", "审批情况", "提交审批", "审批通过", "审批驳回"},
                    new String[]{"生单", "生成生产加工单", "生成销售出库单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "整单中止", "表格调整", "导入", "刷新"})),
            // 请购单:选单灰;生单=采购订单(已实现)
            java.util.Map.entry("PU_REQ", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成采购订单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"导入", "导入"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 采购订单:选单=请购单;生单=采购入库单(已实现)
            java.util.Map.entry("PU_ORDER", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选请购单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成采购入库单"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"导入", "导入"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 采购入库单:选单=采购订单;生单灰(PANDA:生成进货单,进货单未迁移)
            java.util.Map.entry("PURCHASE_IN", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选采购订单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成进货单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 产成品入库单:选单=生产加工单;生单灰(PANDA:生成产成品入库单（自制退库）)
            java.util.Map.entry("FINISH_IN", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选生产加工单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成产成品入库单（自制退库）"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"导入", "导入"})),
            // 其他入库单:选单灰;生单灰(PANDA 无生单组)
            java.util.Map.entry("OTHER_IN", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 销售出库单:选单=销售订单;生单灰(PANDA:生成销货单,销货单未迁移)
            java.util.Map.entry("SALE_OUT", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选销售订单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成销货单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 材料出库单:选单=生产加工单;生单灰(PANDA:生成材料出库单（直接退料）)
            java.util.Map.entry("MATERIAL_OUT", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选生产加工单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成材料出库单（直接退料）"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 其他出库单:选单灰;生单灰(PANDA 无生单组)
            java.util.Map.entry("OTHER_OUT", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 委外三单:新增|选单|保存|删除|审核|生单(灰/委外加工单为 PANDA 首个生单动作)|打印|更多
            java.util.Map.entry("OUTSOURCE_IN", OUTSOURCE_GROUPS_IN),
            java.util.Map.entry("OUTSOURCE_ISSUE", OUTSOURCE_GROUPS_ISSUE),
            java.util.Map.entry("OUTSOURCE_ORDER", OUTSOURCE_GROUPS_ORDER),
            // 生产加工单:选单=销售订单;生单=产成品入库单(已实现)
            java.util.Map.entry("MANU_ORDER", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选销售订单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审批", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"生单", "生成产成品入库单"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "中止执行", "取消中止", "表格调整", "刷新"}))
    )));

    /**
     * 推式生单已实现链路((面板|动作) → 目标面板)。与 PushGenerateHandler 共用——
     * Handler 经 {@link #pushTarget} 查询;按钮生成据此区分可执行动作与灰色占位。
     */
    private static final Map<String, String> PUSH_TARGETS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "PU_REQ|生成采购订单", "PU_ORDER",
            "PU_ORDER|生成采购入库单", "PURCHASE_IN",
            "SO_ORDER|生成生产加工单", "MANU_ORDER",
            "SO_ORDER|生成销售出库单", "SALE_OUT",
            "MANU_ORDER|生成产成品入库单", "FINISH_IN"
    )));

    /** 推式生单目标面板(无实现返回 null)。 */
    public String pushTarget(String panelCode, String action) {
        return PUSH_TARGETS.get(panelCode + "|" + action);
    }

    /** 表单底部按钮(PANDA bottomOperationBarBtn:保存,删除,审核,弃审,+中止类,+放弃)。 */
    private static final Map<String, List<String>> FORM_BOTTOM = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "SO_ORDER", List.of("保存", "删除", "审核", "弃审", "整单中止", "放弃"),
            "MANU_ORDER", List.of("保存", "删除", "审核", "弃审", "中止执行", "草稿", "放弃")
    )));
    private static final List<String> FORM_BOTTOM_DEFAULT = List.of("保存", "删除", "审核", "弃审", "放弃");

    /** 单据流转关系(目标面板 ← 来源面板;对齐 T+ 业务流)。有配置即出现「选单」按钮。 */
    private static final Map<String, String> SELECT_FLOWS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.ofEntries(
            java.util.Map.entry("PURCHASE_IN", "PU_ORDER"),          // 采购订单 → 采购入库单
            java.util.Map.entry("MATERIAL_OUT", "MANU_ORDER"),       // 生产加工单 → 材料出库单
            java.util.Map.entry("FINISH_IN", "MANU_ORDER"),          // 生产加工单 → 产成品入库单
            java.util.Map.entry("DISPATCH", "MANU_ORDER"),           // 生产加工单 → 工序派工单
            java.util.Map.entry("OUTSOURCE_ORDER", "SO_ORDER"),      // 销售订单 → 委外加工单
            java.util.Map.entry("OUTSOURCE_ISSUE", "OUTSOURCE_ORDER"), // 委外加工单 → 委外发料单
            java.util.Map.entry("OUTSOURCE_IN", "OUTSOURCE_ORDER"),  // 委外加工单 → 委外入库单
            java.util.Map.entry("SALE_OUT", "SO_ORDER"),             // 销售订单 → 销售出库单
            java.util.Map.entry("MANU_ORDER", "SO_ORDER"),           // 销售订单 → 生产加工单(销售-生产链)
            java.util.Map.entry("PU_ORDER", "PU_REQ"),               // 请购单 → 采购订单
            java.util.Map.entry("RKD", "CGD"),                       // 采购单(旧) → 入库单(旧)
            java.util.Map.entry("CKD", "KHDD")                       // 客户订单(旧) → 出库单(旧)
    )));

    /** 头字段映射排除项(状态/审批类不参与选单带入)。 */
    private static final java.util.Set<String> FLOW_HEAD_EXCLUDE = java.util.Set.of(
            "编号", "单据状态", "审核人", "审核时间", "审批人", "审批时间", "创建时间", "更新时间");

    /** 明细字段同义词(来源字段 → 目标字段;同名映射之外的补充)。 */
    private static final String[][] FLOW_DETAIL_SYNONYMS = {
            {"存货名称", "产品名称"}, {"存货名称", "材料名称"},
            {"存货编码", "产品编码"}, {"存货编码", "材料编码"},
            {"数量", "实收数量"},
            {"预计交货日期", "预完工日"},
            {"计量单位", "销售单位"}, {"计量单位", "单位"},
            // 两条链路补齐(采购链 PU_ORDER 物料口径 ↔ PU_REQ/PURCHASE_IN 存货口径;销售链单位换名)
            {"物料编码", "存货编码"}, {"物料名称", "存货名称"},
            {"存货编码", "物料编码"}, {"存货名称", "物料名称"},
            {"单位", "计量单位"}, {"销售单位", "计量单位"}, {"生产单位", "计量单位"},
            {"采购单位", "单位"}, {"销售单位", "生产单位"},
    };

    /** 头字段同义词(按链路 source|target 键控;同名映射之外的补充)。 */
    private static final Map<String, String[][]> FLOW_HEAD_SYNONYMS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "PU_REQ|PU_ORDER", new String[][]{{"建议供应商", "供应商"}},
            "PU_ORDER|PURCHASE_IN", new String[][]{{"单据编号", "采购订单号"}},
            "SO_ORDER|MANU_ORDER", new String[][]{{"单据编号", "销售订单号"}},
            "MANU_ORDER|FINISH_IN", new String[][]{{"合同号", "加工单号"}}
    )));

    /** 生单/选单共用的头行映射(目标面板 → {source, headerMap, detailMap});供 PushGenerateHandler 复用。 */
    public Map<String, Object> flowMaps(String targetPanel) {
        Map<String, Object> cfg = buildSelectConfig(registry.panel(targetPanel));
        if (cfg == null) return null;
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("source", cfg.get("source"));
        out.put("headerMap", cfg.get("headerMap"));
        out.put("detailMap", cfg.get("detailMap"));
        return out;
    }

    /** 生成 selectConfig(查询字段/表头表体列/头行映射全自动:同名优先 + 同义词补充)。 */
    private Map<String, Object> buildSelectConfig(PanelRegistry.PanelDef def) {
        String sourceCode = SELECT_FLOWS.get(def.code());
        if (sourceCode == null) return null;
        try {
            PanelRegistry.PanelDef src = registry.panel(sourceCode);
            String srcName = src.displayName(false);
            String noLabel = src.byCol(src.groupCol()) == null ? "单据编号" : src.byCol(src.groupCol()).label();

            Map<String, Object> cfg = new LinkedHashMap<>();
            cfg.put("source", sourceCode);
            cfg.put("title", "选" + srcName);
            cfg.put("tip", "查询已审核" + srcName + ",选择表头后在下方查看并带入对应表体。");
            cfg.put("masterDetail", true);
            cfg.put("headerTitle", srcName + "表头");
            cfg.put("detailTitle", srcName + "表体");
            cfg.put("outsourceFlow", true);
            cfg.put("detailKey", "items");
            cfg.put("targetDetailKey", def.tabKey());
            cfg.put("targetBusinessType", "");
            cfg.put("maxSourceDocuments", 0);

            // 查询字段:来源面板的查询字段(限 6)
            List<Map<String, Object>> qf = new ArrayList<>();
            for (PanelRegistry.FieldDef f : src.fieldsAt("query")) {
                if (qf.size() >= 6) break;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("dataName", f.label());
                m.put("dataType", f.dataType());
                if (f.isRef()) {
                    m.put("refPanel", f.refPanel());
                    m.put("refField", refLabelOf(f.refPanel(), f.refField()));
                    m.put("displayField", refLabelOf(f.refPanel(), f.displayField()));
                }
                qf.add(m);
            }
            cfg.put("queryFields", qf);

            // 表头列:单号 + 日期 + 来源头可见字段(限 8)
            List<String> headCols = new ArrayList<>();
            headCols.add(noLabel);
            PanelRegistry.FieldDef dateField = src.dateCol() == null ? null : src.byCol(src.dateCol());
            if (dateField != null) headCols.add(dateField.label());
            for (PanelRegistry.FieldDef f : src.fieldsAt("header")) {
                if (headCols.size() >= 8) break;
                if (f.hidden() || !f.visible()) continue;
                if (!headCols.contains(f.label()) && !FLOW_HEAD_EXCLUDE.contains(f.label())) headCols.add(f.label());
            }
            cfg.put("headerColumns", headCols);

            // 表体列:来源明细可见字段(限 8)
            List<String> detCols = new ArrayList<>();
            for (PanelRegistry.FieldDef f : src.fieldsAt("detail")) {
                if (detCols.size() >= 8) break;
                if (f.hidden() || !f.visible()) continue;
                detCols.add(f.label());
            }
            cfg.put("detailColumns", detCols);

            // 头映射:来源单号 → 来源单号 + 同名头字段(排除状态类) + 链路同义词(如 合同号→加工单号)
            java.util.Set<String> targetHeads = new java.util.HashSet<>();
            for (PanelRegistry.FieldDef f : def.fieldsAt("header")) targetHeads.add(f.label());
            java.util.Set<String> mappedHeads = new java.util.HashSet<>();
            List<Map<String, String>> hmap = new ArrayList<>();
            hmap.add(Map.of("from", noLabel, "to", "来源单号"));
            for (PanelRegistry.FieldDef f : src.fieldsAt("header")) {
                if (hmap.size() >= 7) break;
                String l = f.label();
                if (FLOW_HEAD_EXCLUDE.contains(l) || l.equals(noLabel) || !targetHeads.contains(l)) continue;
                hmap.add(Map.of("from", l, "to", l));
                mappedHeads.add(l);
            }
            String[][] headSyn = FLOW_HEAD_SYNONYMS.get(sourceCode + "|" + def.code());
            if (headSyn != null) {
                for (String[] s : headSyn) {
                    if (src.byLabel(s[0]) != null && targetHeads.contains(s[1]) && mappedHeads.add(s[0])) {
                        hmap.add(Map.of("from", s[0], "to", s[1]));
                    }
                }
            }
            cfg.put("headerMap", hmap);

            // 行映射:同名明细字段 + 同义词补充
            java.util.Set<String> targetDets = new java.util.HashSet<>();
            for (PanelRegistry.FieldDef f : def.fieldsAt("detail")) targetDets.add(f.label());
            List<Map<String, String>> dmap = new ArrayList<>();
            java.util.Set<String> mapped = new java.util.HashSet<>();
            for (PanelRegistry.FieldDef f : src.fieldsAt("detail")) {
                if (dmap.size() >= 14) break;
                if (targetDets.contains(f.label()) && mapped.add(f.label())) {
                    dmap.add(Map.of("from", f.label(), "to", f.label()));
                }
            }
            for (String[] syn : FLOW_DETAIL_SYNONYMS) {
                if (src.byLabel(syn[0]) != null && targetDets.contains(syn[1]) && mapped.add(syn[1])) {
                    dmap.add(Map.of("from", syn[0], "to", syn[1]));
                }
            }
            cfg.put("detailMap", dmap);
            return cfg;
        } catch (Exception e) {
            return null;
        }
    }

    /** 构建网格列定义(仅可见列,含别名映射)。列键=原中文标签(数据契约);
     *  显示名按 locale 从翻译表供给 columnAliases(别名 > 译名),displayToKey 供反向映射。 */
    private Map<String, Object> buildGridColumns(List<PanelRegistry.FieldDef> fields) {
        boolean foreign = isForeign();
        Map<String, String> dict = foreign ? fieldDict() : Map.of();
        List<String> columns = new ArrayList<>();
        Map<String, Object> aliases = new LinkedHashMap<>();
        Map<String, Object> displayToKey = new LinkedHashMap<>();
        for (PanelRegistry.FieldDef f : fields) {
            if (!f.visible()) continue;
            columns.add(f.label()); // data key = 原标签
            String display = foreign
                    ? (f.alias() != null && !f.alias().isBlank() ? f.alias() : dict.getOrDefault(f.label(), f.label()))
                    : f.displayName();
            if (!display.equals(f.label())) {
                aliases.put(f.label(), display);
                displayToKey.put(display, f.label());
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("columns", columns);
        out.put("columnAliases", aliases);
        out.put("displayToKey", displayToKey);
        return out;
    }

    /** 列名 → 引用面板对应字段的中文标签(找不到则原样返回) */
    private String refLabelOf(String refPanelCode, String colName) {
        if (colName == null || colName.isBlank()) return colName;
        try {
            PanelRegistry.PanelDef refDef = registry.panel(refPanelCode);
            PanelRegistry.FieldDef fd = refDef.byCol(colName);
            return fd != null ? fd.label() : colName;
        } catch (Exception e) {
            return colName;
        }
    }

    /** 执行字典 SQL 取选项(首列);失败返回空列表 */
    public List<String> dictOptions(String dictSql) {
        try {
            List<String> out = new ArrayList<>();
            jdbc.query(dictSql, rs -> {
                Object v = rs.getObject(1);
                if (v != null && !out.contains(String.valueOf(v))) out.add(String.valueOf(v));
            });
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---------- 表格列自定义 ----------

    /** 保存列排序/栏名/显隐(更新 yj_field 的 seq/alias/visible) */
    @SuppressWarnings("unchecked")
    public void saveColumnPrefs(String panelCode, List<Map<String, Object>> columns) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        for (int i = 0; i < columns.size(); i++) {
            Map<String, Object> col = columns.get(i);
            String label = String.valueOf(col.getOrDefault("label", ""));
            String alias = String.valueOf(col.getOrDefault("alias", ""));
            boolean visible = !Boolean.FALSE.equals(col.get("visible")) && !"false".equals(String.valueOf(col.get("visible")));
            PanelRegistry.FieldDef fd = def.byLabel(label);
            if (fd == null) continue;
            jdbc.update("UPDATE yj_field SET seq = ?, alias = ?, visible = ? WHERE panel_code = ? AND col_name = ?",
                    (i + 1) * 10, alias.isBlank() ? null : alias, visible, panelCode, fd.col());
        }
        registry.reload();
    }

    // ---------- 权限矩阵(对齐 light-mes 契约) ----------

    public Map<String, Object> getPermMatrix(String panelCode) {
        Map<String, Object> cfg = getPanelConfig(panelCode);
        @SuppressWarnings("unchecked")
        Map<String, Object> metadata = (Map<String, Object>) cfg.get("metadata");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buttons = (List<Map<String, Object>>) metadata.get("panelButtons");
        List<Map<String, Object>> actions = new ArrayList<>();
        for (Map<String, Object> b : buttons) {
            Map<String, Object> a = new HashMap<>();
            a.put("name", String.valueOf(b.get("buttonName")));
            a.put("visible", true);
            a.put("operatable", true);
            actions.add(a);
        }
        Map<String, Object> privilege = new HashMap<>();
        privilege.put("actionPrivileges", actions);
        privilege.put("fieldPrivileges", new ArrayList<>());
        privilege.put("groupPrivileges", new ArrayList<>());
        Map<String, Object> out = new HashMap<>();
        out.put("privilege", privilege);
        return out;
    }

    // ---------- meta(表单字段描述,对齐 light-mes buildMeta) ----------

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> buildMeta(PanelRegistry.PanelDef def) {
        List<Map<String, Object>> meta = new ArrayList<>();
        // 基础档案(单单据):表单元数据仅"备注"(规范 §八:dataSchema 仅备注)
        if ("archive".equals(def.mode())) {
            Map<String, Object> remark = new LinkedHashMap<>();
            remark.put("code", "备注");
            remark.put("name", "备注");
            remark.put("dataType", "文本");
            remark.put("isNotNull", false);
            remark.put("defaultValue", "");
            meta.add(remark);
            return meta;
        }
        for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", f.label());
            m.put("name", isForeign()
                    ? (f.alias() != null && !f.alias().isBlank() ? f.alias() : fieldDict().getOrDefault(f.label(), f.label()))
                    : f.label());
            m.put("dataType", f.dataType());
            m.put("isNotNull", f.required());
            m.put("defaultValue", "");
            if ("下拉框".equals(f.dataType()) && f.dictSql() != null) m.put("options", dictOptions(f.dictSql()));
            if (f.isRef()) {
                Map<String, Object> ref = new HashMap<>();
                ref.put("panel", f.refPanel());
                ref.put("field", refLabelOf(f.refPanel(), f.refField()));
                ref.put("display", refLabelOf(f.refPanel(), f.displayField()));
                ref.put("filter", null);
                ref.put("map", buildRefMap(def, f));
                ref.put("multi", false);
                ref.put("columns", null);
                m.put("ref", ref);
            }
            meta.add(m);
        }
        return meta;
    }

    /** 从配置取 buttonGroups(轻量路径) */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> groupsOfConfig(Map<String, Object> cfg) {
        Map<String, Object> metadata = (Map<String, Object>) cfg.get("metadata");
        return (List<Map<String, Object>>) metadata.get("buttonGroups");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> actionPrivileges(Map<String, Object> cfg, boolean formPage) {
        Map<String, Object> metadata = (Map<String, Object>) cfg.get("metadata");
        Map<String, Object> pageDto = (Map<String, Object>) metadata.get("panelPageDto");
        List<?> pages = pageDto == null ? null
                : (List<?>) pageDto.get(formPage ? "formPages" : "tablePages");
        if (pages == null || pages.isEmpty()) return new ArrayList<>();
        Map<String, Object> page = (Map<String, Object>) pages.get(0);
        List<?> btns = (List<?>) page.get(formPage ? "bottomOperationBarBtn" : "topBarBtn");
        List<Map<String, Object>> actions = new ArrayList<>();
        if (btns != null) {
            for (Object b : btns) {
                Map<String, Object> btn = (Map<String, Object>) b;
                Map<String, Object> a = new HashMap<>();
                a.put("name", String.valueOf(btn.get("buttonName")));
                a.put("visible", true);
                a.put("operatable", true);
                actions.add(a);
            }
        }
        return actions;
    }
}
