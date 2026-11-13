package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 角色字段视图(2026-11-13 用户口径,**两层,不做个人层**)。
 *
 * <p>用户原话:「不同的角色可以同一面版可以自己调整单据的字段……每个角色都可以独立看到不同的字段」
 * 「两层就够了,从系统到角色的定制,不用在角色下单独区分账号,同一角色看的是一样的」
 * 「要保留原来表格调整的功能不变,并且确保现在做的调整不会回退。然后定制的表格调整是在原来
 * 表格调整的基础上,再做修改的显示或者隐藏」。</p>
 *
 * <p>因此本类只做两件事:</p>
 * <ol>
 *   <li><b>盖一层显示/隐藏</b>:同一面板在「系统整体」({@code yj_field},由原表格调整/表头调整维护)
 *       之上,按角色再定"显示还是隐藏"。<b>只动显隐</b> —— 顺序(seq)与栏名(alias)仍由整体决定。</li>
 *   <li><b>把这一层合进面板配置</b>:{@link #applyTo} 返回一份"该角色看到的"字段清单,
 *       {@link PanelConfigService#buildConfig} 只调用它一次,界面/查询/导出随即全部跟上
 *       (前端渲染代码零改动 —— 表头看 {@code hidden}、明细列看 {@code visible},都是既有契约)。</li>
 * </ol>
 *
 * <p><b>为什么不写 yj_field</b>:写它就是"改全员"的旧行为,是本功能要替换掉的;
 * 而且 2026-11-13 前的历次表格调整已经在 yj_field 里留下了 1302 行隐藏、19 个改过的栏名,
 * 那是现役状态,一行都不能回退。本类对 yj_field <b>只读不写</b>。</p>
 *
 * <p><b>三态</b>:{@code yj_field_view} 里行存在 = 该角色显式设定;行不存在 = 跟随系统整体。
 * 保存时"与整体相同"的项会被删除(而不是存一条冗余行),所以整体以后改了,角色自动跟上。</p>
 *
 * <p><b>必填字段不可隐藏</b>:隐藏一个必填字段 = 用户永远填不了它,保存必然失败。
 * 这里在写入时静默跳过({@link #saveRoleView} 返回被跳过的标签,供界面提示),
 * 合并时也会拒绝把它藏起来 —— 双保险,不靠前端自觉。</p>
 */
@Service
public class PanelFieldViewService {

    private static final Logger LOG = LoggerFactory.getLogger(PanelFieldViewService.class);

    /** 覆盖键分隔符(place_kind + 分隔 + col_name):col_name 是物理列名,不含该字符。 */
    private static final char KEY_SEP = '\u0001';

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public PanelFieldViewService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    // ==================== 读:当前角色 + 覆盖表 ====================

    /**
     * 当前登录账号的角色编码;无会话 / 未分配角色返回 {@code null}
     * (供应商门户口令不走 yj_user,自然也是 null ⇒ 不套角色视图,行为与改造前一致)。
     */
    public String currentRoleCode() {
        String user = currentUserName();
        if (user == null || user.isBlank() || "system".equals(user)) return null;
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT r.role_code FROM yj_user u JOIN yj_role r ON r.id = u.role_id"
                            // ⚠ yj_user.enabled 是 char('1'/'0'),不是 'Y'/'N' —— 2026-11-13 实跑踩过:
                            // 写成 ='Y' 时所有账号都查不到角色,界面表现是"角色列始终为空、保存报未分配角色"
                            + " WHERE u.username = ? AND ISNULL(u.enabled,'1') <> '0'",
                    String.class, user);
            return rows.isEmpty() ? null : rows.get(0);
        } catch (RuntimeException e) {
            // 表/列异常按"无角色"处理:宁可少一层覆盖,也不能让面板打不开
            LOG.warn("[FIELDVIEW] 取角色失败(按无角色处理): {}", e.getMessage());
            return null;
        }
    }

    /** 当前角色 {code,name}(界面显示"本角色:质量审核"用);无角色时 code 为 null */
    public Map<String, Object> currentRole() {
        Map<String, Object> out = new LinkedHashMap<>();
        String user = currentUserName();
        String code = currentRoleCode();
        out.put("username", user == null ? "" : user);
        out.put("roleCode", code == null ? "" : code);
        out.put("roleName", "");
        if (code != null) {
            try {
                List<String> n = jdbc.queryForList("SELECT role_name FROM yj_role WHERE role_code = ?", String.class, code);
                if (!n.isEmpty()) out.put("roleName", n.get(0));
            } catch (RuntimeException ignored) {
                // 名称取不到不影响功能(界面回退显示编码)
            }
        }
        return out;
    }

    /** 该角色在该面板的覆盖:{@code placeKind|col_name → 是否显示} */
    public Map<String, Boolean> overlayOf(String roleCode, String panelCode) {
        Map<String, Boolean> out = new HashMap<>();
        if (roleCode == null || roleCode.isBlank() || panelCode == null || panelCode.isBlank()) return out;
        try {
            jdbc.query("SELECT place_kind, col_name, shown FROM yj_field_view"
                            + " WHERE role_code = ? AND panel_code = ?",
                    rs -> {
                        out.put(rs.getString(1) + KEY_SEP + rs.getString(2), rs.getBoolean(3));
                    }, roleCode, panelCode);
        } catch (RuntimeException e) {
            // 表未建(迁移未执行)时按"无覆盖"处理,不能让整个面板 500
            LOG.warn("[FIELDVIEW] 读覆盖失败(按无覆盖处理) panel={} role={}: {}", panelCode, roleCode, e.getMessage());
        }
        return out;
    }

    /**
     * 对话框数据源:「表头调整 / 表格调整」切到「本角色」时逐行回显。
     *
     * <p>为什么由后端算而不是前端拿覆盖表自己合:覆盖行按 {@code col_name}(物理列名)存,
     * 前端字段只认 {@code label}(中文数据键),让前端自己去猜映射,等于把"同名头行字段"这类
     * 错配风险搬回客户端。这里按 {@code label} 直接给出"本角色是否显示"。</p>
     *
     * <p>每行:{@code label}(保存时原样回传)、{@code shown}(当前生效)、
     * {@code baseShown}(系统整体是什么样)、{@code overridden}(是否被本角色改过)、
     * {@code required}(必填,不可隐藏,界面据此置灰)。</p>
     */
    public Map<String, Object> dialogOf(String panelCode) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String roleCode = currentRoleCode();
        Map<String, Boolean> overlay = overlayOf(roleCode, panelCode);
        Map<String, Object> out = new LinkedHashMap<>(currentRole());
        out.put("panelCode", panelCode);
        for (String kind : new String[]{"header", "detail"}) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (PanelRegistry.FieldDef f : def.fields()) {
                if (!kind.equals(placeKind(f.place()))) continue;
                String key = kind + KEY_SEP + f.col();
                boolean baseShown = baseShown(f, kind);
                Boolean ov = overlay.get(key);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("label", f.label());
                m.put("baseShown", baseShown);
                // 必填字段不允许藏:历史脏行/整体后改为必填的,这里也按"显示"算,与 applyTo 同口径
                m.put("shown", ov == null || f.required() ? baseShown : ov);
                m.put("overridden", ov != null && !f.required());
                m.put("required", f.required());
                rows.add(m);
            }
            out.put(kind, rows);
        }
        out.put("panelCount", roleCode == null ? 0 : rolePanelCount(roleCode));
        return out;
    }

    /** 本角色一共定制过几个面板(界面设置里"本角色定制(N 个面板)"用它) */
    public int rolePanelCount(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) return 0;
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(DISTINCT panel_code) FROM yj_field_view WHERE role_code = ?",
                    Integer.class, roleCode);
            return n == null ? 0 : n;
        } catch (RuntimeException e) {
            return 0;
        }
    }

    // ==================== 合并:把覆盖盖到字段清单上 ====================

    /**
     * 返回"该角色看到的"面板定义(无覆盖 / 无角色 ⇒ 原样返回同一个对象,零开销)。
     *
     * <p>只改渲染真正读的那个标志位,避免误伤另一套语义:</p>
     * <ul>
     *   <li>{@code header} 字段:表单按 {@code hidden} 过滤 ⇒ 覆盖 hidden;</li>
     *   <li>{@code detail} 列:网格按 {@code visible} 过滤 ⇒ 覆盖 visible。</li>
     * </ul>
     * <p>刻意不同时写两个位:明细里存在「hidden=1 但 visible=1」的字段(纸张不印、表格要显示),
     * 一起写会把这类字段从表格里误删。</p>
     */
    public PanelRegistry.PanelDef applyTo(PanelRegistry.PanelDef def) {
        String roleCode = currentRoleCode();
        if (roleCode == null) return def;
        Map<String, Boolean> overlay = overlayOf(roleCode, def.code());
        if (overlay.isEmpty()) return def;
        List<PanelRegistry.FieldDef> fields = new ArrayList<>(def.fields().size());
        for (PanelRegistry.FieldDef f : def.fields()) {
            String kind = placeKind(f.place());
            Boolean shown = kind == null ? null : overlay.get(kind + KEY_SEP + f.col());
            if (shown == null) {
                fields.add(f);
                continue;
            }
            if (!shown && f.required()) {
                // 必填字段:写入侧已拦,这里再兜一次(历史脏行/整体后改为必填的情形)
                fields.add(f);
                continue;
            }
            fields.add(withShown(f, shown, kind));
        }
        return new PanelRegistry.PanelDef(def.code(), def.name(), def.nameEn(), def.category(), def.mode(),
                def.lineTable(), def.headTable(), def.groupCol(), def.pkCol(), def.codeCol(), def.prefix(),
                def.dateCol(), def.pageSize(), def.detailKey(), def.moduleGroup(), def.config(), fields);
    }

    private static PanelRegistry.FieldDef withShown(PanelRegistry.FieldDef f, boolean shown, String kind) {
        boolean hidden = "header".equals(kind) ? !shown : f.hidden();
        boolean visible = "detail".equals(kind) ? shown : f.visible();
        return new PanelRegistry.FieldDef(f.col(), f.label(), f.labelEn(), f.dataType(), f.dictSql(),
                f.refPanel(), f.refField(), f.displayField(), f.refFilter(), f.place(), f.seq(),
                f.editable(), f.required(), hidden, f.width(), f.alias(), visible, f.colGroup(), f.tabKey());
    }

    /** 字段归属哪一层:{@code header}(含 header 即算)优先,其次 {@code detail};查询条件不参与 */
    public static String placeKind(String place) {
        if (place == null) return null;
        String p = place.toLowerCase(Locale.ROOT);
        if (p.contains("header")) return "header";
        if (p.contains("detail")) return "detail";
        return null;
    }

    // ==================== 写:保存 / 恢复继承 ====================

    /**
     * 保存角色视图(只存显隐)。与系统整体相同的项<b>删行</b>(恢复继承),不同的项写行。
     *
     * @param panelCode 面板编码
     * @param placeKind header | detail
     * @param columns   前端提交的整组行 {@code [{label, visible}]}(label = 中文数据键,与既有
     *                  saveColumnPrefs/saveHeaderPrefs 同一匹配口径)
     * @return {@code {saved: 写了多少行, removed: 删了多少行(恢复继承), skippedRequired: [标签...]}}
     */
    public Map<String, Object> saveRoleView(String panelCode, String placeKind, List<Map<String, Object>> columns) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String roleCode = currentRoleCode();
        if (roleCode == null) throw new IllegalArgumentException("当前账号未分配角色,无法设置角色视图");
        String kind = placeKind(placeKind);
        if (kind == null) throw new IllegalArgumentException("只支持表头(header)与明细(detail)两类字段:" + placeKind);

        List<PanelRegistry.FieldDef> base = fieldsOf(def, kind);
        String user = currentUserName();
        int saved = 0, removed = 0;
        List<String> skippedRequired = new ArrayList<>();
        for (Map<String, Object> col : columns == null ? List.<Map<String, Object>>of() : columns) {
            String label = str(col.get("label"));
            boolean wanted = truthy(col.get("visible"));
            // 只在同类字段集合内匹配:同名标签可能头/行并存(SO_ORDER 备注),
            // 与 saveColumnPrefs/saveHeaderPrefs 的既有口径一致
            PanelRegistry.FieldDef f = base.stream().filter(x -> x.label().equals(label)).findFirst().orElse(null);
            if (f == null) continue;
            if (!wanted && f.required()) {
                skippedRequired.add(label);
                continue;
            }
            boolean baseShown = baseShown(f, kind);
            if (wanted == baseShown) {
                removed += delete(panelCode, kind, f.col(), roleCode);
            } else {
                saved += upsert(panelCode, kind, f.col(), roleCode, wanted, user);
            }
        }
        LOG.info("[FIELDVIEW] 保存 panel={} place={} role={} 写入 {} 行 / 恢复继承 {} 行 跳过必填 {} 个",
                panelCode, kind, roleCode, saved, removed, skippedRequired.size());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", saved);
        out.put("removed", removed);
        out.put("skippedRequired", skippedRequired);
        out.put("roleCode", roleCode);
        out.put("panelCount", rolePanelCount(roleCode));
        return out;
    }

    /** 恢复继承:清掉该角色在该面板(或全库)的覆盖 */
    public int resetRoleView(String panelCode) {
        String roleCode = currentRoleCode();
        if (roleCode == null) return 0;
        int n = panelCode == null || panelCode.isBlank()
                ? jdbc.update("DELETE FROM yj_field_view WHERE role_code = ?", roleCode)
                : jdbc.update("DELETE FROM yj_field_view WHERE role_code = ? AND panel_code = ?", roleCode, panelCode);
        LOG.info("[FIELDVIEW] 恢复继承 role={} panel={} 删除 {} 行", roleCode, panelCode, n);
        return n;
    }

    private List<PanelRegistry.FieldDef> fieldsOf(PanelRegistry.PanelDef def, String kind) {
        List<PanelRegistry.FieldDef> out = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fields()) {
            if (kind.equals(placeKind(f.place()))) out.add(f);
        }
        return out;
    }

    /** 系统整体下该字段是否显示(与界面勾选框的判定同源:表头看 hidden,明细看 visible) */
    private static boolean baseShown(PanelRegistry.FieldDef f, String kind) {
        return "header".equals(kind) ? !f.hidden() : f.visible();
    }

    private int delete(String panelCode, String kind, String col, String roleCode) {
        return jdbc.update("DELETE FROM yj_field_view WHERE panel_code = ? AND place_kind = ? AND col_name = ? AND role_code = ?",
                panelCode, kind, col, roleCode);
    }

    private int upsert(String panelCode, String kind, String col, String roleCode, boolean shown, String user) {
        int n = jdbc.update("UPDATE yj_field_view SET shown = ?, operator = ?, updated_at = SYSDATETIME()"
                        + " WHERE panel_code = ? AND place_kind = ? AND col_name = ? AND role_code = ?",
                shown, user, panelCode, kind, col, roleCode);
        if (n > 0) return n;
        jdbc.update("INSERT INTO yj_field_view (panel_code, place_kind, col_name, role_code, shown, operator)"
                        + " VALUES (?,?,?,?,?,?)",
                panelCode, kind, col, roleCode, shown, user);
        return 1;
    }

    // ==================== 小工具 ====================

    private static String currentUserName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return null;
        return auth.getName();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static boolean truthy(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean b) return b;
        String s = String.valueOf(o).trim().toLowerCase(Locale.ROOT);
        return !("false".equals(s) || "0".equals(s) || "n".equals(s) || "".equals(s));
    }
}
