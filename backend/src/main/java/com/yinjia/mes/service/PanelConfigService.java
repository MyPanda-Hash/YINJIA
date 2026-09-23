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
        // 保存组:「保存」= 落库并按面板语义流转(归档面板:管理员保存即归档 / 普通用户自动提交审批);
        // 「保存为草稿」= 只落库不流转(markSaved=false,见 ButtonService)。
        // 用户口径(2026-09-20):侧边栏要同时给「保存(草稿)」与「保存(提交)」两条路,
        // 否则文书面板存一半就必须送审(DOC_ARCHIVE_PANELS 上「保存」会自动归档/送审)。
        // 动作在组里的位置决定侧边栏主按钮与下拉:第一个 = 主按钮,其余进 ▼ 菜单
        // ⇒ 主按钮保持「保存」(即提交),草稿落在下拉,不改变既有主路径的点击习惯。
        buttonGroups.add(group("保存", List.of("保存", "保存新增", "保存为草稿")));
        buttonGroups.add(group("删除", List.of("删除", "删除单据")));
        buttonGroups.add(group("查找", List.of("查找", "刷新")));
        buttonGroups.add(group("打印", List.of("打印", "预览")));
        // 物料二维码标签入口(勾选即打):存货档案工具栏「打印」之后
        // (原定打印与导入之间;远端已决策档案面板不提供导入,导入组移除后即紧跟打印),
        // 前端按 qrLabelKey 列勾行(跨页保留)→ POST /report/qr-label 出 80×80mm 标签 PDF(二维码=存货编码)
        boolean qrLabel = "INV".equals(def.code());
        if (qrLabel) buttonGroups.add(group("二维码标签", List.of("二维码标签")));
        // 导入仅限单据面板(档案面板不提供导入)
        // buttonGroups.add(group("导入", List.of("下载模板", "导入")));
        buttonGroups.add(group("更多", List.of("复制", "表格调整", "导出", "退出")));
        // 分类管理入口(金蝶同款交互):客户/供应商/商品 档案从工具栏进分类维护,分类面板不占左侧导航
        String classifyPanel = switch (def.code()) {
            case "KHDA" -> "CUSGRP"; case "GFDA" -> "SUPGRP"; case "INV" -> "MATGRP"; default -> null;
        };
        String classifyTitle = null;
        if (classifyPanel != null) {
            try { classifyTitle = registry.panel(classifyPanel).name(); } catch (Exception ignored) { }
            if (classifyTitle != null) buttonGroups.add(group("分类管理", List.of("分类管理")));
        }

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
        if (gridInfo.get("columnGroups") != null) gridTab.put("columnGroups", gridInfo.get("columnGroups"));

        Map<String, Object> tablePage = new LinkedHashMap<>();
        tablePage.put("tableName", panelDisplay + (foreign ? " List" : "列表"));
        // 查询字段(2026-09-20):档案/单单据面板是"一张虚拟单据 + 全量明细行",表头只剩「备注」,
        // 原来这里硬编码空列表 → 「查询」弹窗没有任何可用条件;改为取元数据里登记了 query 位的常规字段
        // (migrate-basedata-query-fields.sql 给每个基础资料面板挑了 ≤6 个:编码/名称/规格/分类/停用…)
        List<Map<String, Object>> singleQueryFields = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fieldsAt("query")) singleQueryFields.add(fieldSpec(def, f));
        tablePage.put("queryFields", singleQueryFields);
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
        if (classifyPanel != null && classifyTitle != null) {
            metadata.put("classifyPanel", classifyPanel);   // 前端「分类管理」跳转目标面板码
            metadata.put("classifyTitle", classifyTitle);   // 页签标题
        }
        if (qrLabel) metadata.put("qrLabelKey", "存货编码"); // 前端二维码标签勾选列的行键(编码列)
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
            // 库存三报表的金额列读 inv_cost_ledger(移动加权成本),口径=物化值,需可手工重算:
            // 审核钩子覆盖走 ButtonService 的审核,但金蝶同步等旁路写入不经过审核动作。
            // 插在 表格调整 之前——其后的「表头调整」是按 表格调整 的位置注入的,不能打乱。
            buttonGroups.add(group("更多", INV_COST_PANELS.contains(def.code())
                    ? List.of("发送邮件", "重算成本", "表格调整", "退出")
                    : List.of("发送邮件", "表格调整", "退出")));
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
            // 保存组:「保存」= 落库并按面板语义流转(归档面板:管理员保存即归档 / 普通用户自动提交审批);
            // 「保存为草稿」= 只落库不流转(markSaved=false,见 ButtonService)。
            // 用户口径(2026-09-20):侧边栏要同时给「保存(草稿)」与「保存(提交)」两条路 ——
            //   没这条动作时,文书面板存一半就必须送审(DOC_ARCHIVE_PANELS 上「保存」会自动归档/送审)。
            // 位置:第一个动作 = 侧边栏主按钮,其余进 ▼ 下拉 ⇒ 主按钮仍是「保存」(即提交),
            //   草稿落在下拉,不改变既有主路径的点击习惯(与 PANDA_BUTTONS 各单据的写法一致)。
            buttonGroups.add(group("保存", List.of("保存", "保存为草稿")));
            buttonGroups.add(group("删除", List.of("删除")));
            buttonGroups.add(group("审批", List.of("审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审")));
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
        if (gridInfo.get("columnGroups") != null) main.put("columnGroups", gridInfo.get("columnGroups"));
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
        // 报表查询弹窗入口(T+ 同款):进入面板先弹查询条件(日期段必填),关闭弹窗即退出页面;前端 PanelxList 消费
        if (List.of("STOCK_SUMMARY", "STOCK_LEDGER").contains(def.code())) metadata.put("reportQueryDialog", true);
        metadata.put("singleDoc", panelSingleDoc(def.code()));   // 见 yj_panel.config 的 singleDoc
        metadata.put("autoCodeField", doc ? autoCodeLabel(def) : null);
        // 保存即归档文书面板(真源 ButtonService.DOC_ARCHIVE_PANELS):前端据此放出
        // 「申请修改/修改审批/修改记录」闭环按钮(2026-09-11 起从产品文件 7 面板放开到全部文书归档面板)
        metadata.put("docArchive", ButtonService.DOC_ARCHIVE_PANELS.contains(def.code()));
        // 产品变更申请单(2026-09-21):按账号部门的**行级编辑门禁**要下发给前端(界面把非本部门行置灰只读)。
        // 真源 = yj_change_dept(纸面部门 ↔ 系统部门映射),与后端 ButtonService.gateChangeDetail 同一张表;
        // 前端拿到的是"我能填哪几个部门行",管理员另行豁免(前端按登录用户 isAdmin 判)。
        if ("RD_CHANGE".equals(def.code())) {
            metadata.put("changeDepts", changeDeptsOfCurrentUser());
        }
        metadata.put("panelState", Map.of(
                "dataName", "单据状态",
                "dataType", "STRING",
                "defaultOptions", List.of("草稿", "已审核", "已完成", "审批中", "已中止", "已作废")));
        metadata.put("panelButtons", panelButtons);
        // 表头调整(与「表格调整」成对,管理表头字段的排序/栏名/显隐):紧跟表格调整之后插入
        for (Map<String, Object> g : buttonGroups) {
            @SuppressWarnings("unchecked")
            List<String> gActions = (List<String>) g.get("actions");
            int at = gActions.indexOf("表格调整");
            if (at >= 0 && !gActions.contains("表头调整")) {
                List<String> merged = new ArrayList<>(gActions);
                merged.add(at + 1, "表头调整");
                g.put("actions", merged);
            }
        }
        metadata.put("buttonGroups", buttonGroups);
        if (!disabledActions.isEmpty()) metadata.put("disabledActions", disabledActions);
        // 生单动作 → 目标面板(前端据此判断该动作是否走"分批送料对话框":目标面板配了批次号即分批)
        Map<String, Object> pushTargets = new LinkedHashMap<>();
        for (Map<String, Object> g : buttonGroups) {
            Object acts = g.get("actions");
            if (!(acts instanceof List<?> list)) continue;
            for (Object a : list) {
                String action = String.valueOf(a);
                String t = pushTarget(def.code(), action);
                if (t != null && !disabledActions.contains(action)) pushTargets.put(action, t);
            }
        }
        if (!pushTargets.isEmpty()) metadata.put("pushTargets", pushTargets);
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
        // 有明细字段的单据面板:至少需要一行明细才可保存(前端 validateInlineDraft 消费)
        tab.put("isRequired", !detailFields.isEmpty());
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

    /** 明细自动计算规则:按字段组合推导常见公式(字段名=行键,引擎按中文名取值求值)。
     *  兼容两套命名:标准(单价/金额/含税单价/含税金额)与销售(售价/销售金额/含税售价/含税销售金额)。 */
    private List<Map<String, Object>> buildCalcRules(List<PanelRegistry.FieldDef> detailFields) {
        java.util.Set<String> labels = new java.util.HashSet<>();
        for (PanelRegistry.FieldDef f : detailFields) labels.add(f.label());
        List<Map<String, Object>> out = new ArrayList<>();
        // 数量列:优先"数量",退而"实收数量"
        String qty = labels.contains("数量") ? "数量" : labels.contains("实收数量") ? "实收数量" : null;
        // 单价/金额列:标准 或 销售命名(SALE_OUT 用 售价/销售金额/含税售价/含税销售金额)
        String price = labels.contains("单价") ? "单价" : labels.contains("售价") ? "售价" : null;
        String amount = labels.contains("金额") ? "金额" : labels.contains("销售金额") ? "销售金额" : null;
        String taxPrice = labels.contains("含税单价") ? "含税单价" : labels.contains("含税售价") ? "含税售价" : null;
        String taxAmount = labels.contains("含税金额") ? "含税金额" : labels.contains("含税销售金额") ? "含税销售金额" : null;
        boolean hasPrice = price != null;
        if (qty != null && hasPrice && amount != null) calcRule(out, amount, qty + "*" + price, 2);
        if (hasPrice && labels.contains("税率%") && taxPrice != null) calcRule(out, taxPrice, price + "*(1+税率%/100)", 4);
        if (qty != null && taxPrice != null && taxAmount != null) calcRule(out, taxAmount, qty + "*" + taxPrice, 2);
        if (amount != null && labels.contains("税率%") && labels.contains("税额")) calcRule(out, "税额", amount + "*税率%/100", 2);
        if (qty != null && hasPrice && labels.contains("折扣%") && labels.contains("折扣金额")) calcRule(out, "折扣金额", qty + "*" + price + "*折扣%/100", 2);
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
        // 字段编辑的显隐开关(存 yj_field.visible):显式 false 才下发,前端据此隐藏该列
        if (!f.visible()) m.put("visible", false);
        if (!f.editable()) m.put("readonly", true);
        if ("下拉框".equals(f.dataType()) && f.dictSql() != null) {
            m.put("options", dictOptions(f.dictSql()));
        } else if ("标准库".equals(f.dataType()) && f.dictSql() != null) {
            // 标准库:dict_sql 存标准库编码(见 migrate-lab-stdlib.sql),选项来自 yj_std_lib,可维护
            m.put("options", stdLibOptions(f.dictSql()));
            m.put("stdLib", f.dictSql());
        }
        if (f.isRef()) {
            m.put("refPanel", f.refPanel());
            m.put("refField", refLabelOf(f.refPanel(), f.refField()));
            m.put("displayField", refLabelOf(f.refPanel(), f.displayField()));
            // 参照过滤(数据驱动,存 yj_field.ref_filter;见 tools/migrate-ref-filter.sql):
            //   原先硬编码 if ("RD_APPROVAL".equals(refPanel)) —— 新增参照(RD_PROD_INFO/RD_PROGRESS)
            //   同样要"只列已归档"口径,继续堆 if 就是又一份清单,与新面板/新字段脱节。
            //   ref_filter 为 NULL ⇒ 不下发 filter ⇒ 行为与改造前**逐字等价**(纯增量)。
            Map<String, Object> refFilter = parseRefFilter(f.refFilter());
            if (!refFilter.isEmpty()) m.put("filter", refFilter);
            List<Map<String, String>> refMap = buildRefMap(def, f);
            if (!refMap.isEmpty()) m.put("refMap", refMap);
        }
        return m;
    }

    /**
     * 解析参照过滤条件文本 → Map。
     * 格式:<b>k=v</b> 单条件,或 <b>k=v,k2=v2</b> 多条件(逗号分隔,值可含 =)。
     * 空白/非法项直接跳过 —— 解析不出任何条件时返回空 Map(等价"不过滤"),
     * 保证老数据(ref_filter 为 NULL)行为不变。
     */
    private Map<String, Object> parseRefFilter(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        for (String part : raw.split(",")) {
            String seg = part.trim();
            if (seg.isEmpty()) continue;
            int i = seg.indexOf('=');
            if (i <= 0 || i == seg.length() - 1) continue;       // 缺键或缺值:跳过
            String k = seg.substring(0, i).trim();
            String v = seg.substring(i + 1).trim();
            if (!k.isEmpty() && !v.isEmpty()) out.put(k, v);
        }
        return out;
    }

    /** 参照带回映射(对齐 light-mes ref.map 契约):
     *  1) 同名字段自动映射;2) 同义词映射(引用面板字段 → 本面板异名字段)。
     *  参照弹窗选中后整串回填——如选存货同时带出 存货编码/规格型号/单位/单价 等。
     *  2026-09-09:本单自身标识字段(分组列/单据号列/日期列/主键列)永不参与带回——
     *  单据→单据参照(数据记录表→立项申请)同名标签会冲掉本单的单据编号/单据日期,
     *  保存时唯一性校验把本单当成重复单据而拒绝。 */
    private List<Map<String, String>> buildRefMap(PanelRegistry.PanelDef def, PanelRegistry.FieldDef f) {
        List<Map<String, String>> out = new ArrayList<>();
        if (def == null || f.refPanel() == null) return out;
        try {
            PanelRegistry.PanelDef refDef = registry.panel(f.refPanel());
            java.util.Set<String> mapped = new java.util.HashSet<>(selfIdentityLabels(def));
            for (PanelRegistry.FieldDef sibling : def.fields()) {
                if (sibling.label().equals(f.label())) continue;
                if (mapped.contains(sibling.label())) continue;
                PanelRegistry.FieldDef refSide = refDef.byLabel(sibling.label());
                if (refSide != null && carryTypeAllowed(sibling.dataType(), refSide.dataType())) {
                    out.add(Map.of("from", sibling.label(), "to", sibling.label()));
                    mapped.add(sibling.label());
                }
            }
            // 同义词:引用面板字段名 → 本面板可能的异名字段名(如 存货的"计量单位"→单据的"销售单位/单位/采购单位")
            for (Map.Entry<String, List<String>> e : REF_SYNONYMS.entrySet()) {
                PanelRegistry.FieldDef fromSide = refDef.byLabel(e.getKey());
                if (fromSide == null) continue;
                for (String target : e.getValue()) {
                    if (target.equals(f.label()) || mapped.contains(target) || def.byLabel(target) == null) continue;
                    if (!carryTypeAllowed(def.byLabel(target).dataType(), fromSide.dataType())) continue;
                    out.add(Map.of("from", e.getKey(), "to", target));
                    mapped.add(target);
                }
            }
        } catch (Exception ignore) { /* 引用面板不存在时静默跳过 */ }
        return out;
    }

    /** 本单自身标识字段的标签集合(分组列=单据编号 / 单据号列 / 日期列 / 主键列):参照带回禁止覆盖 */
    private java.util.Set<String> selfIdentityLabels(PanelRegistry.PanelDef def) {
        java.util.Set<String> out = new java.util.HashSet<>();
        for (String col : new String[]{def.groupCol(), def.codeCol(), def.dateCol(), def.pkCol()}) {
            if (col == null || col.isBlank()) continue;
            PanelRegistry.FieldDef fd = def.byCol(col);
            if (fd != null) out.add(fd.label());
        }
        return out;
    }

    /** 参照带回类型闸门:「是否」型不参与带回(任一侧是即禁止)。
     *  同名≠同义——如 往来单位.结算客户(是否,0/1标志) 与 销售订单.结算客户(客户名下拉) 同名异义,
     *  映射会把 0/1 写进名称字段;「停用」等档案标志同理不该串到单据上。
     *  文本/下拉框/参照之间存值同构(中文字符串),互带合法。 */
    private static boolean carryTypeAllowed(String a, String b) {
        return !"是否".equals(a) && !"是否".equals(b);
    }

    /** 参照带回同义词词典(引用面板字段 → 本面板异名字段候选,命中即映射)。
     *  选存货整串带回:编码/名称的 材料/产品/物料 异名口径 + 各单位口径 + 参考成本→单价。 */
    private static final Map<String, List<String>> REF_SYNONYMS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "计量单位", List.of("单位", "销售单位", "采购单位", "生产单位"),
            "参考成本", List.of("单价"),
            "存货编码", List.of("材料编码", "产品编码", "物料编码"),
            "存货名称", List.of("材料名称", "产品名称", "物料名称"),
            // 选客户/供应商整串带回:往来单位的编码/名称 → 单据的客户编码/供应商编码 与 客户/供应商(编码↔名称双向带动)
            "往来单位编码", List.of("客户编码", "供应商编码"),
            "往来单位名称", List.of("供应商", "客户"),
            // 供应商档案(GFDA)整串带回:编码/名称 ↔ 单据的 供应商代码/供应商 异名字段(编码↔名称双向带动)
            "供应商编码", List.of("供应商代码"),
            "供应商名称", List.of("供应商"),
            // 产品信息表 炭棒尺寸(整串) → 产品文件面板异名规格字段;三窄格 炭棒规格1/2/3 由前端拆分回填
            "炭棒尺寸", List.of("炭棒规格", "滤芯尺寸"),
            // 立项申请 项目等级(审核人定级) → 项目实施计划的 项目定级(异名同义):
            // 计划按「文档编号」参照立项申请时自动把等级带过来 —— 等级因此成为后续立项/进度流程的属性
            // (2026-09-21 用户口径:全链路一/二/三/四级)
            "项目等级", List.of("项目定级")
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
    /** 读 inv_cost_ledger(移动加权成本)的库存三报表:工具栏放出「重算成本」(与 ButtonService.INV_COST_PANELS 同集合)。 */
    private static final List<String> INV_COST_PANELS = List.of("STOCK_LEDGER", "STOCK_SUMMARY", "STOCK_BALANCE");

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
            // 采购订单:选单=请购单;生单=送料暂收单(唯一出口,2026-09-22 起不再免检直达采购入库单)
            java.util.Map.entry("PU_ORDER", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选请购单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成送料暂收单"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"导入", "导入"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 采购入库单:选单=送料暂收单(2026-09-22 起;原为采购订单,那条免检直达已被取消);
            // 生单灰(PANDA:生成进货单,进货单未迁移)。
            // 打头的「选单」必须保留:工具栏主按钮取 actions[0],而 selectConfigFor() 只认字面量
            // 「选单」—— 主按钮若写成「选XX」会回落成「演示环境暂未实现」。
            java.util.Map.entry("PURCHASE_IN", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选单", "选送料暂收单"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成进货单"},
                    new String[]{"转ERP", "转ERP", "批量转ERP"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"},
                    new String[]{"修改", "修改"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"导入", "导入"})),
            // 来料检验单(原检验单,2026-09-15 改名):选单=送料暂收单(QC_RECV 暂收入库单已下线,
            // 其表头角色由 QC_RECV 送料暂收单承接);审核/审批通过时自动生成
            // 采购入库单(合格行,实收数量=合格数量)+暂收退回单(不良行,数量=不良数量)
            // (ButtonService.inspAutoPurchaseIn/inspAutoReturn)。工具栏生单组保留占位(对齐 T+ 灰按钮):
            // 无 pushTarget 实现时由 metadata.disabledActions 输出恒灰占位,不参与实际生单
            java.util.Map.entry("QC_INSP", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选送料暂收单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成采购入库单", "生成暂收退回单"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 暂收退回单:选单=来料检验单;生单灰(无下游)
            java.util.Map.entry("QC_RETURN", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选来料检验单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 送料暂收单(库存核算,2026-09-20 面板编码 SL_RECV→QC_RECV):选单=采购订单;
            // 生单=来料检验单(主按钮,走品检)/ 采购入库单(2026-09-22 新增,免检直达 —— 采购订单的生单
            // 出口已收敛到本单,去向由暂收这一个人工判定);两条都走分批生单(本单头有批次号 → 一键整单、不弹框)。
            // 修改保存后由 ButtonService.syncInspFromSlRecv 同步修改已生成的来料检验单
            java.util.Map.entry("QC_RECV", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选采购订单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成来料检验单", "生成采购入库单"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
            // 生产工单(计划层):选单=销售订单;五道工序共用工单;标签=工单二维码(扫码报工/领料入口)
            java.util.Map.entry("WO_ORDER", List.of(
                    new String[]{"新增", "新增"},
                    new String[]{"选单", "选销售订单"},
                    new String[]{"修改", "修改"},
                    new String[]{"保存", "保存", "保存新增", "保存为草稿"},
                    new String[]{"删除", "删除", "删除单据"},
                    new String[]{"审核", "审核", "弃审"},
                    new String[]{"审批", "提交审批", "审批通过", "驳回审批"},
                    new String[]{"生单", "生成领料单"},
                    new String[]{"标签", "打印工单二维码", "打印产品二维码"},
                    new String[]{"查找", "查找", "刷新"},
                    new String[]{"打印", "打印", "预览", "导出"},
                    new String[]{"更多", "复制", "放弃", "草稿", "表格调整", "刷新"})),
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
                    new String[]{"转ERP", "转ERP", "批量转ERP"},
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
     *
     * 2026-09-22 用户口径:**所有采购订单都必须先生成送料暂收单** —— 取消「采购订单→采购入库单」
     * 免检直达(该跳原为 PU_ORDER|生成采购入库单),改由送料暂收单去向分流的两个按钮承接:
     * 暂收单人工判:走检验 → QC_RECV|生成来料检验单;免检直达 → QC_RECV|生成采购入库单。
     * 两条出口必须同时关(PUSH_TARGETS 这一条 + SELECT_FLOWS 的 PURCHASE_IN 来源),否则选单路径仍可绕过。
     */
    private static final Map<String, String> PUSH_TARGETS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(java.util.Map.ofEntries(
            java.util.Map.entry("PU_REQ|生成采购订单", "PU_ORDER"),
            java.util.Map.entry("PU_ORDER|生成送料暂收单", "QC_RECV"),
            java.util.Map.entry("SO_ORDER|生成生产加工单", "MANU_ORDER"),
            java.util.Map.entry("SO_ORDER|生成销售出库单", "SALE_OUT"),
            java.util.Map.entry("MANU_ORDER|生成产成品入库单", "FINISH_IN"),
            java.util.Map.entry("QC_RECV|生成来料检验单", "QC_INSP"),
            java.util.Map.entry("QC_RECV|生成采购入库单", "PURCHASE_IN"),
            java.util.Map.entry("WO_ORDER|生成领料单", "MATERIAL_OUT")
    )));

    /** 推式生单目标面板(无实现返回 null)。 */
    public String pushTarget(String panelCode, String action) {
        return PUSH_TARGETS.get(panelCode + "|" + action);
    }

    /**
     * 推式生单行过滤((面板|动作) → {字段, =/!=, 值}):同一来源按行拆到不同目标单时使用。
     * 现无在用条目(2026-09-16:检验单→入库/退回两条已随手工生单组移除——该过滤仅支持等值
     * 匹配且引用的 处置方式 列在检验明细并不存在,行级 合格/不良 拆分改由审核自动生单实现)。
     */
    private static final Map<String, String[]> PUSH_DETAIL_FILTERS = Map.of();

    /** 推式生单行过滤条件(无则 null)。 */
    public String[] detailFilter(String panelCode, String action) {
        return PUSH_DETAIL_FILTERS.get(panelCode + "|" + action);
    }

    /** 表单底部按钮(PANDA bottomOperationBarBtn:保存,删除,审核,弃审,+中止类,+放弃)。 */
    private static final Map<String, List<String>> FORM_BOTTOM = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "SO_ORDER", List.of("保存", "删除", "审核", "弃审", "整单中止", "放弃"),
            "MANU_ORDER", List.of("保存", "删除", "审核", "弃审", "中止执行", "草稿", "放弃")
    )));
    private static final List<String> FORM_BOTTOM_DEFAULT = List.of("保存", "删除", "审核", "弃审", "放弃");

    /** 单据流转关系(目标面板 ← 来源面板;对齐 T+ 业务流)。有配置即出现「选单」按钮。 */
    private static final Map<String, String> SELECT_FLOWS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.ofEntries(
            java.util.Map.entry("PURCHASE_IN", "QC_RECV"),           // 送料暂收单 → 采购入库单(2026-09-22:原 采购订单,
                                                                     //   免检直达已取消,来源收敛到暂收单;见 PUSH_TARGETS 注释)
            java.util.Map.entry("MATERIAL_OUT", "MANU_ORDER"),       // 生产加工单 → 材料出库单
            java.util.Map.entry("FINISH_IN", "MANU_ORDER"),          // 生产加工单 → 产成品入库单
            java.util.Map.entry("DISPATCH", "MANU_ORDER"),           // 生产加工单 → 工序派工单
            java.util.Map.entry("OUTSOURCE_ORDER", "SO_ORDER"),      // 销售订单 → 委外加工单
            java.util.Map.entry("OUTSOURCE_ISSUE", "OUTSOURCE_ORDER"), // 委外加工单 → 委外发料单
            java.util.Map.entry("OUTSOURCE_IN", "OUTSOURCE_ORDER"),  // 委外加工单 → 委外入库单
            java.util.Map.entry("SALE_OUT", "SO_ORDER"),             // 销售订单 → 销售出库单
            java.util.Map.entry("MANU_ORDER", "SO_ORDER"),           // 销售订单 → 生产加工单(销售-生产链)
            java.util.Map.entry("PU_ORDER", "PU_REQ"),               // 请购单 → 采购订单
            java.util.Map.entry("QC_RECV", "PU_ORDER"),              // 采购订单 → 送料暂收单(库存核算,2026-09-15;编码 9-20 由 SL_RECV 改)
            java.util.Map.entry("QC_INSP", "QC_RECV"),               // 送料暂收单 → 来料检验单(暂收入库单已下线,来源指向送料暂收单 QC_RECV)
            java.util.Map.entry("QC_RETURN", "QC_INSP"),             // 来料检验单 → 暂收退回单
            java.util.Map.entry("WO_ORDER", "SO_ORDER"),             // 销售订单 → 生产工单(计划层:选单生单)
            java.util.Map.entry("RKD", "CGD"),                       // 采购单(旧) → 入库单(旧)
            java.util.Map.entry("CKD", "KHDD")                       // 客户订单(旧) → 出库单(旧)
    )));

    /** 头字段映射排除项(状态/审批类不参与选单带入;附件1-6是按单号锚定的文件实体,
     *  靠字段值映射带入既无意义又占 7 条映射上限的坑——曾把 QC_RECV→QC_INSP 的日期挤丢)。 */
    private static final java.util.Set<String> FLOW_HEAD_EXCLUDE = java.util.Set.of(
            "编号", "单据状态", "审核人", "审核时间", "审批人", "审批时间", "创建时间", "更新时间",
            "附件1", "附件2", "附件3", "附件4", "附件5", "附件6");

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
            {"规格型号", "型号"},
            {"单位", "计量单位"}, {"销售单位", "计量单位"}, {"生产单位", "计量单位"},
            {"采购单位", "单位"}, {"销售单位", "生产单位"},
            // 品检分流三链(暂收→检验→入库/退回)的数量口径换名
            {"暂收数量", "送检数量"},
            // 送料暂收单行字段名为「数量」,而检验单侧为「送检数量」——同义词只登记了 暂收数量→送检数量,
            // 致 送料暂收→来料检验 生单后 送检数量 永远为空(实测存量 0/9 行有值),检验员无从知道送检量;
            // 2026-09-20 补 数量→送检数量(仅 QC_INSP 有该目标字段,不影响其它链路)
            {"数量", "送检数量"},
            {"合格数量", "实收数量"},
            {"不合格数量", "退货数量"},
            // 行级仓库沿链贯通(2026-09-21):采购订单行/暂收行叫「仓库」,检验行叫「仓库代码」,入库行又叫「仓库」
            {"仓库", "仓库代码"}, {"仓库代码", "仓库"},
            // 采购链订单行号(2026-09-20):采购订单行 行号(金蝶 seq)→ 下游各站 采购订单行号,
            // 逐站下传后在 采购入库行 落 源单行号,转ERP 推给金蝶作 src_seq
            {"行号", "采购订单行号"},
            // 送料批次号(2026-09-20 分批送料 P0):同名直通,逐站下传(暂收→检验→入库/退回)
            {"批次号", "批次号"},
            // 计划层(销售订单 → 生产工单)的产品口径换名
            {"存货编码", "产品编码"}, {"存货名称", "产品名称"},
            {"数量", "订单数量"},
    };

    /** 头字段同义词(按链路 source|target 键控;同名映射之外的补充)。 */
    private static final Map<String, String[][]> FLOW_HEAD_SYNONYMS = java.util.Collections.unmodifiableMap(new java.util.LinkedHashMap<>(Map.of(
            "PU_REQ|PU_ORDER", new String[][]{{"建议供应商", "供应商"}},
            // 送料暂收单 → 采购入库单(2026-09-22 新增;原 PU_ORDER|PURCHASE_IN 免检直达已取消,
            // 那条只需 单据编号→采购订单号,本跳的采购订单号随链从采购订单带下来了、同名直通无需登记)。
            // 供应商代码→供应商编码:暂收单头叫「供应商代码」,入库头叫「供应商编码」——异名不带则入库单
            // 供应商编码恒空(与 QC_INSP|PURCHASE_IN 当年同一个坑)。注:批次键由
            // PushGenerateHandler.generateBatch 直接写入,不走映射(头映射 7 条上限会把它挤掉,不影响)。
            "QC_RECV|PURCHASE_IN", new String[][]{{"供应商代码", "供应商编码"}},
            "SO_ORDER|MANU_ORDER", new String[][]{{"单据编号", "销售订单号"}},
            "MANU_ORDER|FINISH_IN", new String[][]{{"合同号", "加工单号"}},
            // 来料检验单 → 采购入库单:检验单号落外部单据号;采购订单号随链带入(2026-09-20,
            // 选单路径走本表;审核自动生单路径见 ButtonService.inspAutoPurchaseIn 同步补列)
            // + 批次号(2026-09-20 分批送料 P0:批次号沿 暂收→检验→入库 贯通,同一批次可反查四单)
            "QC_INSP|PURCHASE_IN", new String[][]{{"单号", "外部单据号"}, {"采购订单号", "采购订单号"}, {"批次号", "批次号"}, {"批次键", "批次键"},
                    // 供应商编码(2026-09-21):检验单头字段叫「供应商代码」,入库头叫「供应商编码」——
                    // 异名不带则入库单供应商编码恒空(实测 0/13,并连带影响下游)
                    {"供应商代码", "供应商编码"}},
            // 来料检验单 → 暂收退回单:检验单号落「检验单号」;采购订单号随链带入(2026-09-20,
            // 选单路径走本表;审核自动生单路径见 ButtonService.inspAutoReturn)+ 批次号
            "QC_INSP|QC_RETURN", new String[][]{{"单据编号", "检验单号"}, {"采购订单号", "采购订单号"}, {"批次号", "批次号"}},
            "SO_ORDER|WO_ORDER", new String[][]{{"单据编号", "销售订单号"}, {"预计交货日期", "交期"}},
            // 采购订单 → 送料暂收单:表头日期标签不同(单据日期→日期);供应商编码→供应商代码(异名,不带则生单丢失编码)
            // + 采购订单号(2026-09-20:订单号/订单行号须沿链下传,转ERP 时作金蝶源单关联 src_bill_no/src_seq)
            // 注:批次号由分批生单自动取号写入(PushGenerateHandler.generateBatch),不走映射
            "PU_ORDER|QC_RECV", new String[][]{{"供应商编码", "供应商代码"}, {"单据编号", "采购订单号"}}, // 日期已同名(暂收单头字段 2026-09-21 统一为「单据日期」)
            // 送料暂收单 → 来料检验单:日期同名,但头映射 7 条上限曾被附件占坑挤丢,同义词追加无上限兜底
            // (采购订单号同理显式登记,不受同名 7 条上限影响;批次号同批补,保证检验单继承暂收单批次)
            "QC_RECV|QC_INSP", new String[][]{{"采购订单号", "采购订单号"}, {"批次号", "批次号"}, {"批次键", "批次键"},
                    // 暂收单号(2026-09-21):检验单头有**专门的「暂收单号」字段**(参照 QC_RECV),
                    // 原先只盲写「来源单号」(qc_insp 表根本没这列) → 实测 0/22;改写到真实字段
                    {"单号", "暂收单号"}}
    )));

    /** 生单/选单共用的头行映射(目标面板 → {source, headerMap, detailMap});供 PushGenerateHandler 复用。 */
    public Map<String, Object> flowMaps(String targetPanel) {
        return flowMaps(SELECT_FLOWS.get(targetPanel), targetPanel);
    }

    /**
     * 指定来源的头行映射:推式生单用(目标面板可有多个来源,如 采购入库单 ← 送料暂收单(暂收后判免检) /
     * 来料检验单(检验合格);2026-09-22 起来源不再含采购订单本身);
     * 选单 UI 仍用单来源 flowMaps(target)(SELECT_FLOWS 主来源)。
     */
    public Map<String, Object> flowMaps(String sourcePanel, String targetPanel) {
        if (sourcePanel == null) return null;
        Map<String, Object> cfg = buildSelectConfig(registry.panel(targetPanel), sourcePanel);
        if (cfg == null) return null;
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("source", cfg.get("source"));
        out.put("headerMap", cfg.get("headerMap"));
        out.put("detailMap", cfg.get("detailMap"));
        return out;
    }

    /** 生成 selectConfig(查询字段/表头表体列/头行映射全自动:同名优先 + 同义词补充)。 */
    private Map<String, Object> buildSelectConfig(PanelRegistry.PanelDef def) {
        return buildSelectConfig(def, SELECT_FLOWS.get(def.code()));
    }

    /** 指定来源版本(推式生单多来源链路)。 */
    private Map<String, Object> buildSelectConfig(PanelRegistry.PanelDef def, String sourceCode) {
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
            // 分批送料(2026-09-20 P0):目标面板配了「批次号」表头字段 → 选单走分批生单接口
            // (按量占用 + 自动批次号 + 台账),不再走"整行照搬 + link"通用路径
            cfg.put("batchFlow", def.fieldsAt("header").stream().anyMatch(f -> "批次号".equals(f.label())));
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
        Map<String, List<String>> groupOrder = new LinkedHashMap<>(); // 父表头分组:col_group → 数据键列表(首现顺序)
        for (PanelRegistry.FieldDef f : fields) {
            if (!f.visible()) continue;
            columns.add(f.label()); // data key = 原标签
            if (f.colGroup() != null && !f.colGroup().isBlank()) {
                groupOrder.computeIfAbsent(f.colGroup(), k -> new ArrayList<>()).add(f.label());
            }
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
        if (!groupOrder.isEmpty()) {
            List<Map<String, Object>> groups = new ArrayList<>();
            groupOrder.forEach((g, cols) -> groups.add(Map.of("label", g, "columns", cols)));
            out.put("columnGroups", groups); // 报表两级表头(前端 reportColumnTree 消费:组列+无组散列)
        }
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

    /**
     * 标准库选项:字段 data_type=\u0027标准库\u0027 时,dict_sql 里存的是**标准库编码**(lib_code),
     * 不再是可执行 SQL;条目取自 yj_std_lib,可在界面上增删维护(StdLibController /api/stdlib/add|remove)。
     */
    public List<String> stdLibOptions(String libCode) {
        try {
            List<String> out = new ArrayList<>();
            jdbc.query("SELECT content FROM yj_std_lib WHERE lib_code = ? AND enabled = 1"
                            + " AND ISNULL(asp_cancel, \u0027N\u0027) <> \u0027Y\u0027 ORDER BY seq, id",
                    rs -> {
                        Object v = rs.getObject(1);
                        if (v != null && !out.contains(String.valueOf(v))) out.add(String.valueOf(v));
                    }, libCode);
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }
    // ---------- 表格列自定义 ----------

    /** 保存列排序/栏名/显隐(更新 yj_field 的 seq/alias;显隐 hidden+visible 同开同关——
     *  编辑表格按 hidden 过滤,只写 visible 会出现"取消勾选后字段仍在表格末尾显示"的不一致,
     *  2026-09-17 对齐表头调整口径修复) */
    @SuppressWarnings("unchecked")
    public void saveColumnPrefs(String panelCode, List<Map<String, Object>> columns) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        // 只在明细字段集合内匹配,防同名头/行字段(如 SO_ORDER 备注)误改头字段
        List<PanelRegistry.FieldDef> details = def.fieldsAt("detail");
        for (int i = 0; i < columns.size(); i++) {
            Map<String, Object> col = columns.get(i);
            String label = String.valueOf(col.getOrDefault("label", ""));
            String alias = String.valueOf(col.getOrDefault("alias", ""));
            boolean visible = !Boolean.FALSE.equals(col.get("visible")) && !"false".equals(String.valueOf(col.get("visible")));
            PanelRegistry.FieldDef fd = details.stream().filter(f -> f.label().equals(label)).findFirst().orElse(null);
            if (fd == null) continue;
            jdbc.update("UPDATE yj_field SET seq = ?, alias = ?, hidden = ?, visible = ? WHERE panel_code = ? AND col_name = ?",
                    (i + 1) * 10, alias.isBlank() ? null : alias, !visible, visible, panelCode, fd.col());
        }
        registry.reload();
    }

    /** 保存表头字段排序/栏名/显隐(表头调整;更新 yj_field 的 seq/alias,显隐 hidden+visible 同开同关) */
    public void saveHeaderPrefs(String panelCode, List<Map<String, Object>> columns) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        List<PanelRegistry.FieldDef> headers = def.fieldsAt("header");
        for (int i = 0; i < columns.size(); i++) {
            Map<String, Object> col = columns.get(i);
            String label = String.valueOf(col.getOrDefault("label", ""));
            String alias = String.valueOf(col.getOrDefault("alias", ""));
            boolean visible = !Boolean.FALSE.equals(col.get("visible")) && !"false".equals(String.valueOf(col.get("visible")));
            // 同名标签可能头/行并存(如 SO_ORDER 备注):只在表头字段集合内匹配,避免误改行字段
            PanelRegistry.FieldDef fd = headers.stream().filter(f -> f.label().equals(label)).findFirst().orElse(null);
            if (fd == null) continue;
            jdbc.update("UPDATE yj_field SET seq = ?, alias = ?, hidden = ?, visible = ? "
                            + "WHERE panel_code = ? AND col_name = ? AND place LIKE '%header%'",
                    (i + 1) * 10, alias.isBlank() ? null : alias, !visible, visible, panelCode, fd.col());
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
            if (f.hidden()) m.put("hidden", true);   // 表头调整隐藏的字段:表单渲染侧过滤(PanelxForm visibleMeta)
            if ("下拉框".equals(f.dataType()) && f.dictSql() != null) {
                m.put("options", dictOptions(f.dictSql()));
            } else if ("标准库".equals(f.dataType()) && f.dictSql() != null) {
                m.put("options", stdLibOptions(f.dictSql()));
                m.put("stdLib", f.dictSql());
            }
            if (f.isRef()) {
                Map<String, Object> ref = new HashMap<>();
                ref.put("panel", f.refPanel());
                ref.put("field", refLabelOf(f.refPanel(), f.refField()));
                ref.put("display", refLabelOf(f.refPanel(), f.displayField()));
                // 参照过滤:此前**硬编码 null** ⇒ 表单侧参照弹窗拿不到"只列已归档"限制,
                // 与列表侧 fieldSpec 下发的不一致(同一字段两处口径不同)。改为同源解析。
                Map<String, Object> refFilter = parseRefFilter(f.refFilter());
                ref.put("filter", refFilter.isEmpty() ? null : refFilter);
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

    /**
     * 单单据面板判定:yj_panel.config 里写了 "singleDoc": true,即认为该面板只有一张单据 ——
     * 前端会隐藏「新增单据」等入口(PanelxList 的 singleDocMode 分支),但**保留 doc 状态机**
     * (草稿/已审核/归档流程不变)。项目进度查询(RD_PROGRESS)即用它:全部项目都放在同一张单据里。
     * 读 config 用字符串匹配而不是 JSON_VALUE —— 库兼容级别 100,JSON 函数要 130+。
     */
    private boolean panelSingleDoc(String panelCode) {
        try {
            String cfg = jdbc.queryForObject(
                    "SELECT ISNULL(CONVERT(nvarchar(max), config), '') FROM yj_panel WHERE panel_code = ?",
                    String.class, panelCode);
            if (cfg == null || cfg.isBlank()) return false;
            String compact = cfg.replace(" ", "").replace("\r", "").replace("\n", "").replace("\t", "");
            return compact.contains("\"singleDoc\":true");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 当前登录账号可填写的产品变更申请单**纸面部门行**(2026-09-21)。
     * 口径与 ButtonService.gateChangeDetail 完全一致:yj_user.dept_id → yj_change_dept.dept_id → 纸面部门名;
     * 取不到账号/未登记部门返回空表(前端则整表只读,只有管理员可代填)。
     */
    private List<String> changeDeptsOfCurrentUser() {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            String user = auth == null ? null : auth.getName();
            if (user == null || user.isBlank()) return List.of();
            // ⚠ 不能用 SELECT DISTINCT ... ORDER BY sort:SQL Server 要求 DISTINCT 的排序列出现在选择列表里,
            //    否则整条语句报错(被本方法的 catch 吞成空表 → 界面整表只读,2026-09-21 实测踩到)。
            //    与 ButtonService.changeDeptRows 同一写法:GROUP BY 部门, sort + ORDER BY MIN(sort)。
            return jdbc.queryForList("SELECT c.部门 FROM yj_change_dept c JOIN yj_user u ON u.dept_id = c.dept_id"
                    + " WHERE u.username = ? GROUP BY c.部门, c.sort ORDER BY MIN(c.sort)", String.class, user);
        } catch (Exception e) {
            // 表还没迁移/查询失败:返回空=界面整表只读(服务端仍有强制还原),但**要留日志**,别静默
            org.slf4j.LoggerFactory.getLogger(PanelConfigService.class)
                    .warn("[RD_CHANGE] 读取当前账号可填部门失败,界面将整表只读: {}", e.getMessage());
            return List.of();
        }
    }
}
