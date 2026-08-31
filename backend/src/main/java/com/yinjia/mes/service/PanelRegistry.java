package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 面板注册表:从 HSDZ_MES 的 yj_panel/yj_field 读取元数据。
 * 面板与字段定义全部以数据库为准(可手工调整 yj_field 后自动生效)。
 */
@Service
public class PanelRegistry {

    /** 字段定义(以 yj_field 为准;label 为数据键保持中文,label_en 仅显示层译名) */
    public record FieldDef(String col, String label, String labelEn, String dataType, String dictSql,
                           String refPanel, String refField, String displayField,
                           String place, int seq, boolean editable, boolean required,
                           boolean hidden, Integer width, String alias, boolean visible) {
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
                           Integer pageSize, String detailKey, String moduleGroup,
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
        /** 模块分组(对齐 HSDZ permission.GROP;缺省 系统管理) */
        public String moduleName() {
            return moduleGroup == null || moduleGroup.isBlank() ? "系统管理" : moduleGroup;
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
    private volatile Map<String, PanelDef> cache;
    private volatile long loadedAt = 0;
    private static final long TTL_MS = 30_000;

    public PanelRegistry(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public synchronized void reload() {
        Map<String, List<FieldDef>> byPanel = new HashMap<>();
        jdbc.query("SELECT panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible FROM yj_field ORDER BY panel_code, seq, id",
                rs -> {
                    String pc = rs.getString("panel_code");
                    byPanel.computeIfAbsent(pc, k -> new ArrayList<>()).add(new FieldDef(
                            rs.getString("col_name"), rs.getString("label"), rs.getString("label_en"), rs.getString("data_type"),
                            rs.getString("dict_sql"), rs.getString("ref_panel"), rs.getString("ref_field"),
                            rs.getString("display_field"), rs.getString("place"), rs.getInt("seq"),
                            rs.getBoolean("editable"), rs.getBoolean("required"),
                            rs.getBoolean("hidden"), (Integer) rs.getObject("width"),
                            rs.getString("alias"), rs.getBoolean("visible")));
                });
        Map<String, PanelDef> out = new HashMap<>();
        jdbc.query("SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group FROM yj_panel",
                rs -> {
                    String code = rs.getString("panel_code");
                    out.put(code, new PanelDef(code, rs.getString("panel_name"), rs.getString("panel_name_en"), rs.getString("category"),
                            rs.getString("mode"), rs.getString("line_table"), rs.getString("head_table"),
                            rs.getString("group_col"), rs.getString("pk_col"), rs.getString("code_col"),
                            rs.getString("prefix"), rs.getString("date_col"), (Integer) rs.getObject("page_size"),
                            rs.getString("detail_key"), rs.getString("module_group"), byPanel.getOrDefault(code, List.of())));
                });
        this.cache = out;
        this.loadedAt = System.currentTimeMillis();
    }

    public PanelDef panel(String panelCode) {
        if (cache == null || System.currentTimeMillis() - loadedAt > TTL_MS) reload();
        PanelDef def = cache.get(panelCode);
        if (def == null) throw new IllegalArgumentException("面板不存在：" + panelCode);
        return def;
    }

    public List<PanelDef> all() {
        if (cache == null || System.currentTimeMillis() - loadedAt > TTL_MS) reload();
        return new ArrayList<>(cache.values());
    }
}
