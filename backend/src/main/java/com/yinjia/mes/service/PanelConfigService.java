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
        Map<String, String> fixed = foreign ? translations.translate(localeKey(), List.of("明细", "列表")) : Map.of();
        String detailLabel = foreign ? fixed.getOrDefault("明细", "Details") : "明细";
        String listSuffix = foreign ? " " + fixed.getOrDefault("列表", "List") : "列表";

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

        // 工具栏按钮组(照搬 light-mes 审批流:单据=审批组[提交审批/审批通过/审批驳回/审批情况/弃审])
        List<String> flatButtons = flat ? List.of("刷新")
                : doc ? List.of("新增", "保存", "删除", "提交审批", "审批通过", "审批驳回", "审批情况", "弃审", "刷新")
                : List.of("新增", "保存", "删除", "刷新");
        List<Map<String, Object>> buttonGroups = new ArrayList<>();
        if (!flat) {
            buttonGroups.add(group("新增", List.of("新增")));
            buttonGroups.add(group("保存", List.of("保存")));
            buttonGroups.add(group("删除", List.of("删除")));
            if (doc) buttonGroups.add(group("审批", List.of("提交审批", "审批通过", "审批驳回", "审批情况", "弃审")));
        }
        buttonGroups.add(group("刷新", List.of("刷新")));
        // 表格列自定义(所有面板:更多组含表格调整;首个动作=主按钮,表格调整须在第二位及以后才进下拉)
        List<String> moreActions = new ArrayList<>(List.of("复制", "表格调整", "导出"));
        if (!flat) moreActions.add("退出");
        buttonGroups.add(group("更多", moreActions));

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
        formPage.put("bottomOperationBarBtn", panelButtons);
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
                "defaultOptions", List.of("草稿", "已审核", "审批中", "已作废")));
        metadata.put("panelButtons", panelButtons);
        metadata.put("buttonGroups", buttonGroups);
        metadata.put("panelPageDto", pageDto);
        metadata.put("formPages", List.of(formPage));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metadata", metadata);
        out.put("dataSchema", Map.of("fields", headerFields));
        Map<String, Object> detail = new LinkedHashMap<>();
        Map<String, Object> tab = new LinkedHashMap<>();
        tab.put("key", "items");
        tab.put("label", detailLabel);
        tab.put("fields", detailFields);
        detail.put("tabs", List.of(tab));
        out.put("detail", detail);
        return out;
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
        }
        return m;
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
                ref.put("map", null);
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
