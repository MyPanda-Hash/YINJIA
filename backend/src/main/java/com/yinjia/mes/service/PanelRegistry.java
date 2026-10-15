package com.yinjia.mes.service;

import com.yinjia.mes.config.DataSourceRouter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 面板注册表:从 yj_panel/yj_field 读取元数据。
 * 面板与字段定义全部以数据库为准(可手工调整 yj_field 后自动生效)。
 *
 * ⚠ 两账套(ADR-0003):元数据**按账套各存一份**(键 = {@link DataSourceRouter#current()})。
 * 早期版本只有一个 cache 字段 + 30s TTL ⇒ 两个账套在 TTL 窗口内共用同一份,
 * 「谁先刷新谁说了算」——症状是在测试账套新增面板/字段后接口仍报「面板不存在」或按旧结构返回
 * (2026-09-22 实测,见技术债 #11 与回归探针 tools/verify/panel-cache-ledger-test.cjs)。
 */
@Service
public class PanelRegistry {

    /** 字段定义(以 yj_field 为准;label 为数据键保持中文,label_en 仅显示层译名) */
    public record FieldDef(String col, String label, String labelEn, String dataType, String dictSql,
                           String refPanel, String refField, String displayField,
                           String refFilter,
                           String place, int seq, boolean editable, boolean required,
                           boolean hidden, Integer width, String alias, boolean visible, String colGroup,
                           String tabKey) {
        /** 显示名:别名优先,缺省用原标签 */
        public String displayName() { return alias != null && !alias.isBlank() ? alias : label; }
        /** 按 locale 的显示名:用户自定义别名最优先,其次译名(label_en),缺省原中文标签 */
        public String displayLabel(boolean en) {
            if (alias != null && !alias.isBlank()) return alias;
            if (en && labelEn != null && !labelEn.isBlank()) return labelEn;
            return label;
        }
        public boolean inPlace(String p) { return place != null && place.contains(p); }
        public boolean isRef() { return "参照".equals(dataType); }
    }

    /** 面板定义(以 yj_panel 为准;panel_name 为显示基线,panel_name_en 为译名) */
    public record PanelDef(String code, String name, String nameEn, String category, String mode,
                           String lineTable, String headTable, String groupCol,
                           String pkCol, String codeCol, String prefix, String dateCol,
                           Integer pageSize, String detailKey, String moduleGroup, String config,
                           List<FieldDef> fields) {
        public boolean isDoc() { return "doc".equals(mode); }
        public boolean hasHeadTable() { return headTable != null && !headTable.isBlank(); }
        /** 按 locale 的面板显示名 */
        public String displayName(boolean en) {
            return en && nameEn != null && !nameEn.isBlank() ? nameEn : name;
        }
        /** 明细页签键(与接口返回 detail.<key> 一致;缺省 items) */
        public String tabKey() {
            return detailKey == null || detailKey.isBlank() ? "items" : detailKey;
        }

        private static final com.fasterxml.jackson.databind.ObjectMapper CONFIG_JSON =
                new com.fasterxml.jackson.databind.ObjectMapper();

        /**
         * **唯一键声明**(yj_panel.config 的 {@code "uniqueKeys"},2026-10-16 起):
         * 每个元素是一组「组内列不得重复出现同一取值」的字段标签(数据键=中文 label)。
         * 写法:{@code {"uniqueKeys":["工序编码"]}}(单列)或
         * {@code {"uniqueKeys":[["仓库","仓位编码"]]}}(组合键);两种可混用。
         *
         * <p>用途:全是**声明式**的 —— ButtonService.saveArchive 据此在落库前预检
         * (给业务话术),PanelConfigService 把同一份声明下发给前端做保存前即时查重。
         * 哪张面板哪几列唯一由元数据说了算,**不加代码**(与"加面板=插行"同一条规矩)。
         *
         * <p>解析失败(手写 config 写坏)时返回空表并在日志里骂一句:宁可不拦业务,
         * 也不能因为一段配置让整个面板存不进去 —— 数据库侧的过滤唯一索引仍是最后一道闸。
         */
        public List<List<String>> uniqueKeys() {
            if (config == null || !config.contains("uniqueKeys")) return List.of();
            try {
                com.fasterxml.jackson.databind.JsonNode node = CONFIG_JSON.readTree(config).path("uniqueKeys");
                if (!node.isArray()) return List.of();
                List<List<String>> out = new ArrayList<>();
                for (com.fasterxml.jackson.databind.JsonNode e : node) {
                    List<String> keys = new ArrayList<>();
                    if (e.isArray()) {
                        for (com.fasterxml.jackson.databind.JsonNode k : e) {
                            if (k.isTextual() && !k.asText().isBlank()) keys.add(k.asText().trim());
                        }
                    } else if (e.isTextual() && !e.asText().isBlank()) {
                        keys.add(e.asText().trim());
                    }
                    if (!keys.isEmpty()) out.add(List.copyOf(keys));
                }
                return List.copyOf(out);
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(PanelRegistry.class)
                        .warn("[uniqueKeys] 面板 {} 的 config 不是合法 JSON,唯一性预检跳过:{}", code, config);
                return List.of();
            }
        }
        /** 模块分组(对齐 HSDZ permission.GROP;缺省 其他) */
        public String moduleName() {
            return moduleGroup == null || moduleGroup.isBlank() ? "其他" : moduleGroup;
        }
        public List<FieldDef> fieldsAt(String place) {
            return fields.stream().filter(f -> f.inPlace(place)).toList();
        }
        /** 中文标签 -> 列名(同名列出现在多个 place 时以先注册为准) */
        public Map<String, String> labelToCol() {
            Map<String, String> m = new HashMap<>();
            for (FieldDef f : fields) m.putIfAbsent(f.label(), f.col());
            return m;
        }
        public FieldDef byLabel(String label) {
            return fields.stream().filter(f -> f.label().equals(label)).findFirst().orElse(null);
        }
        public FieldDef byCol(String col) {
            return fields.stream().filter(f -> f.col().equals(col)).findFirst().orElse(null);
        }
    }

    private final JdbcTemplate jdbc;
    /** 每账套一份快照:ledger(DataSourceRouter.PROD/TEST) -> 该库的面板定义 */
    private record Snapshot(Map<String, PanelDef> defs, long loadedAt) {}
    private final Map<String, Snapshot> caches = new ConcurrentHashMap<>();
    private static final long TTL_MS = 30_000;

    public PanelRegistry(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public synchronized void reload() {
        Map<String, List<FieldDef>> byPanel = new HashMap<>();
        jdbc.query("SELECT panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field, display_field, ref_filter, place, seq, width, editable, required, hidden, alias, visible, col_group, tab_key FROM yj_field ORDER BY panel_code, seq, id",
                rs -> {
                    String pc = rs.getString("panel_code");
                    byPanel.computeIfAbsent(pc, k -> new ArrayList<>()).add(new FieldDef(
                            rs.getString("col_name"), rs.getString("label"), rs.getString("label_en"), rs.getString("data_type"),
                            rs.getString("dict_sql"), rs.getString("ref_panel"), rs.getString("ref_field"),
                            rs.getString("display_field"), rs.getString("ref_filter"), rs.getString("place"), rs.getInt("seq"),
                            rs.getBoolean("editable"), rs.getBoolean("required"),
                            rs.getBoolean("hidden"), (Integer) rs.getObject("width"),
                            rs.getString("alias"), rs.getBoolean("visible"), rs.getString("col_group"),
                            rs.getString("tab_key")));
                });
        Map<String, PanelDef> out = new HashMap<>();
        jdbc.query("SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config FROM yj_panel",
                rs -> {
                    String code = rs.getString("panel_code");
                    out.put(code, new PanelDef(code, rs.getString("panel_name"), rs.getString("panel_name_en"), rs.getString("category"),
                            rs.getString("mode"), rs.getString("line_table"), rs.getString("head_table"),
                            rs.getString("group_col"), rs.getString("pk_col"), rs.getString("code_col"),
                            rs.getString("prefix"), rs.getString("date_col"), (Integer) rs.getObject("page_size"),
                            rs.getString("detail_key"), rs.getString("module_group"),
                            rs.getString("config"), byPanel.getOrDefault(code, List.of())));
                });
        caches.put(DataSourceRouter.current(), new Snapshot(out, System.currentTimeMillis()));
    }

    /** 当前账套的元数据快照;过期或无则重载。账套取自路由上下文(无上下文=正式库,安全默认)。 */
    private Map<String, PanelDef> snapshot() {
        String ledger = DataSourceRouter.current();
        Snapshot s = caches.get(ledger);
        if (s == null || System.currentTimeMillis() - s.loadedAt() > TTL_MS) {
            reload();
            s = caches.get(ledger);
            if (s == null) throw new IllegalStateException("面板注册表加载失败：" + ledger);
        }
        return s.defs();
    }

    public PanelDef panel(String panelCode) {
        PanelDef def = snapshot().get(panelCode);
        if (def == null) throw new IllegalArgumentException("面板不存在：" + panelCode);
        return def;
    }

    public List<PanelDef> all() {
        return new ArrayList<>(snapshot().values());
    }
}
