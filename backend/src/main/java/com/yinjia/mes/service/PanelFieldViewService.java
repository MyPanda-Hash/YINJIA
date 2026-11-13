package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 角色字段视图(2026-11-13,**两层,不做个人层**)。
 *
 * <p>用户口径(两轮合并):</p>
 * <blockquote>
 * ① 「不同的角色可以同一面版可以自己调整单据的字段……每个角色都可以独立看到不同的字段」<br>
 * ② 「两层就够了,从系统到角色的定制,不用在角色下单独区分账号,同一角色看的是一样的」<br>
 * ③ 「要保留原来表格调整的功能不变,并且确保现在做的调整不会回退。然后定制的表格调整是在原来
 *    表格调整的基础上,再做修改的显示或者隐藏」<br>
 * ④ 「只存显隐,也可调整位置,并且这个字段排序,可以用序号来调整位置,**只有勾选的字段了才有序号**」<br>
 * ⑤ 「角色模板:从整体一键复制 / 套用到另一个角色」
 * </blockquote>
 *
 * <p>数据模型:</p>
 * <ul>
 *   <li><b>系统整体</b> = {@code yj_field}(原「表格调整/表头调整」照旧写它,**功能一字未改**);</li>
 *   <li><b>角色</b> = {@code yj_field_view}:一行 = 该角色对某字段的「显示/隐藏 + 角色内序号」;</li>
 *   <li><b>三态</b>:有行 ⇒ 该角色显式设定;没有行 ⇒ 跟随系统整体。</li>
 * </ul>
 *
 * <p><b>排序规则(第 ④ 条)</b>:只有"勾选(显示)"的字段才有序号(1..n,行内 {@code seq});
 * 隐藏字段的 seq 为空。真正渲染时的顺序:<b>先按序号排(小的在前),再放"没有行/没有序号"的字段</b>
 * —— 后者按系统整体顺序追加在末尾。于是整体以后新增的字段不会因为这个角色没编号而消失,
 * 只是默认落在最后一行,等着被编号。</p>
 *
 * <p><b>为什么不写 yj_field</b>:写它就是"改全员"的旧行为;而且 2026-11-13 前的历次表格调整
 * 已经在 yj_field 留下 1302 行隐藏、19 个改过的栏名,那是现役状态,一行都不能回退。
 * 本类对 yj_field <b>只读不写</b>。</p>
 *
 * <p><b>必填字段不可隐藏</b>:隐藏必填字段 = 用户永远填不了它,保存必然失败。写入侧静默跳过并回报,
 * 合并侧再兜一次(历史脏行 / 整体后改为必填的情形)。</p>
 */
@Service
public class PanelFieldViewService {

    private static final Logger LOG = LoggerFactory.getLogger(PanelFieldViewService.class);

    /** 覆盖键分隔符(place_kind + 分隔 + col_name) */
    private static final char KEY_SEP = '\u0001';

    /** 一条覆盖:是否显示 + 角色内序号(仅显示时有意义,隐藏为 null) */
    public record Row(boolean shown, Integer seq) {}

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

    /** 当前角色 {code,name}(界面显示"本角色:质量审核"用);无角色时 code 为空串 */
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

    /** 当前账号是否管理员(「套用到另一个角色」只给管理员) */
    public boolean isAdmin() {
        String user = currentUserName();
        if (user == null) return false;
        try {
            List<String> r = jdbc.queryForList("SELECT is_admin FROM yj_user WHERE username = ?", String.class, user);
            return !r.isEmpty() && "Y".equalsIgnoreCase(String.valueOf(r.get(0)).trim());
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** 该角色在该面板的覆盖:{@code placeKind|col_name → Row} */
    public Map<String, Row> overlayOf(String roleCode, String panelCode) {
        Map<String, Row> out = new HashMap<>();
        if (roleCode == null || roleCode.isBlank() || panelCode == null || panelCode.isBlank()) return out;
        try {
            jdbc.query("SELECT place_kind, col_name, shown, seq FROM yj_field_view"
                            + " WHERE role_code = ? AND panel_code = ?",
                    rs -> {
                        Object seq = rs.getObject(4);
                        out.put(rs.getString(1) + KEY_SEP + rs.getString(2),
                                new Row(rs.getBoolean(3), seq == null ? null : rs.getInt(4)));
                    }, roleCode, panelCode);
        } catch (RuntimeException e) {
            // 表未建(迁移未执行)时按"无覆盖"处理,不能让整个面板 500
            LOG.warn("[FIELDVIEW] 读覆盖失败(按无覆盖处理) panel={} role={}: {}", panelCode, roleCode, e.getMessage());
        }
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

    /**
     * 对话框数据源:「表头调整 / 表格调整」切到「本角色」时逐行回显。
     *
     * <p>为什么由后端算:覆盖行按 {@code col_name}(物理列名)存,前端字段只认 {@code label}
     * (中文数据键),让前端自己猜映射等于把"同名头行字段"这类错配风险搬回客户端。</p>
     *
     * <p>每行:{@code label}(保存时原样回传)、{@code shown}(当前生效)、{@code seq}
     * (角色内序号 1..n,**隐藏字段为 null**)、{@code baseShown}(系统整体是什么样)、
     * {@code overridden}(是否被本角色改过)、{@code required}(必填,不可隐藏)。</p>
     */
    public Map<String, Object> dialogOf(String panelCode) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String roleCode = currentRoleCode();
        Map<String, Row> overlay = overlayOf(roleCode, panelCode);
        Map<String, Object> out = new LinkedHashMap<>(currentRole());
        out.put("panelCode", panelCode);
        for (String kind : new String[]{"header", "detail"}) {
            List<Map<String, Object>> rows = new ArrayList<>();
            int no = 0;   // 只给"显示"的字段编 1..n(隐藏字段没有序号,与用户口径一致)
            for (PanelRegistry.FieldDef f : ordered(def, kind, overlay)) {
                String key = kind + KEY_SEP + f.col();
                Row ov = overlay.get(key);
                boolean baseShown = baseShown(f, kind);
                boolean shown = ov == null ? baseShown : (f.required() || ov.shown());
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("label", f.label());
                m.put("baseShown", baseShown);
                m.put("shown", shown);
                m.put("seq", shown ? ++no : null);
                m.put("overridden", ov != null && !f.required() && (ov.shown() != baseShown || ov.seq() != null));
                m.put("required", f.required());
                rows.add(m);
            }
            out.put(kind, rows);
        }
        out.put("panelCount", roleCode == null ? 0 : rolePanelCount(roleCode));
        out.put("isAdmin", isAdmin());
        return out;
    }

    /** 可套用的角色清单(「套用到另一个角色」的下拉) */
    public List<Map<String, Object>> roleList() {
        List<Map<String, Object>> out = new ArrayList<>();
        try {
            // ⚠ ORDER BY 的列必须出现在 GROUP BY 里(SQL Server):只 group by role_code/role_name
            // 再 order by r.id 会报"列无效",异常被下面兜住 → 界面下拉**静默为空**(2026-11-13 实跑踩过)
            jdbc.query("SELECT r.id, r.role_code, r.role_name, COUNT(DISTINCT v.panel_code) AS n"
                            + " FROM yj_role r LEFT JOIN yj_field_view v ON v.role_code = r.role_code"
                            + " GROUP BY r.id, r.role_code, r.role_name ORDER BY r.id",
                    rs -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("code", rs.getString(2));
                        m.put("name", rs.getString(3));
                        m.put("panelCount", rs.getInt(4));
                        out.add(m);
                    });
        } catch (RuntimeException e) {
            LOG.warn("[FIELDVIEW] 取角色清单失败: {}", e.getMessage());
        }
        return out;
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
        Map<String, Row> overlay = overlayOf(roleCode, def.code());
        if (overlay.isEmpty()) return def;
        List<PanelRegistry.FieldDef> fields = new ArrayList<>(def.fields().size());
        for (String kind : new String[]{"header", "detail"}) {
            fields.addAll(ordered(def, kind, overlay));
        }
        // 其余(查询条件等)保持原样、原顺序
        for (PanelRegistry.FieldDef f : def.fields()) {
            if (placeKind(f.place()) == null) fields.add(f);
        }
        // 统一重编号,保持注册表里 seq=10,20,30… 的既有约定
        List<PanelRegistry.FieldDef> numbered = new ArrayList<>(fields.size());
        for (int i = 0; i < fields.size(); i++) numbered.add(withSeq(fields.get(i), (i + 1) * 10));
        return new PanelRegistry.PanelDef(def.code(), def.name(), def.nameEn(), def.category(), def.mode(),
                def.lineTable(), def.headTable(), def.groupCol(), def.pkCol(), def.codeCol(), def.prefix(),
                def.dateCol(), def.pageSize(), def.detailKey(), def.moduleGroup(), def.config(), numbered);
    }

    /**
     * 某 place 的字段,按"角色序号"排好序:先放有序号且显示的(按 seq 升序),
     * 再放其余(没行/没号/被隐藏的)并保持系统整体顺序。
     * 返回的 FieldDef 里 seq 已按显示位置重编成 10,20…(隐藏字段保留原 seq 只为稳定)。
     */
    private List<PanelRegistry.FieldDef> ordered(PanelRegistry.PanelDef def, String kind, Map<String, Row> overlay) {
        List<PanelRegistry.FieldDef> numbered = new ArrayList<>();
        List<PanelRegistry.FieldDef> rest = new ArrayList<>();
        for (PanelRegistry.FieldDef f : def.fields()) {
            if (!kind.equals(placeKind(f.place()))) continue;
            String key = kind + KEY_SEP + f.col();
            Row ov = overlay.get(key);
            boolean baseShown = baseShown(f, kind);
            boolean shown = ov == null ? baseShown : (f.required() || ov.shown());
            boolean hasSeq = ov != null && ov.seq() != null && shown;
            PanelRegistry.FieldDef v = withShown(f, shown, kind);
            if (hasSeq) {
                numbered.add(withSeq(v, ov.seq() * 10));
            } else {
                rest.add(v);
            }
        }
        numbered.sort(Comparator.comparingInt(PanelRegistry.FieldDef::seq));
        List<PanelRegistry.FieldDef> out = new ArrayList<>(numbered);
        out.addAll(rest);
        return out;
    }

    private static PanelRegistry.FieldDef withShown(PanelRegistry.FieldDef f, boolean shown, String kind) {
        boolean hidden = "header".equals(kind) ? !shown : f.hidden();
        boolean visible = "detail".equals(kind) ? shown : f.visible();
        return new PanelRegistry.FieldDef(f.col(), f.label(), f.labelEn(), f.dataType(), f.dictSql(),
                f.refPanel(), f.refField(), f.displayField(), f.refFilter(), f.place(), f.seq(),
                f.editable(), f.required(), hidden, f.width(), f.alias(), visible, f.colGroup(), f.tabKey());
    }

    private static PanelRegistry.FieldDef withSeq(PanelRegistry.FieldDef f, int seq) {
        return new PanelRegistry.FieldDef(f.col(), f.label(), f.labelEn(), f.dataType(), f.dictSql(),
                f.refPanel(), f.refField(), f.displayField(), f.refFilter(), f.place(), seq,
                f.editable(), f.required(), f.hidden(), f.width(), f.alias(), f.visible(), f.colGroup(), f.tabKey());
    }

    /** 字段归属哪一层:{@code header}(含 header 即算)优先,其次 {@code detail};查询条件不参与 */
    public static String placeKind(String place) {
        if (place == null) return null;
        String p = place.toLowerCase(Locale.ROOT);
        if (p.contains("header")) return "header";
        if (p.contains("detail")) return "detail";
        return null;
    }

    // ==================== 写:保存 / 恢复继承 / 模板复制 ====================

    /**
     * 保存角色视图(显隐 + 角色内序号)。
     *
     * @param panelCode 面板编码
     * @param placeKind header | detail
     * @param columns   前端提交的整组行 {@code [{label, visible, seq}]}
     *                  (label = 中文数据键,与既有 saveColumnPrefs/saveHeaderPrefs 同一匹配口径)
     * @return {@code {saved, skippedRequired:[...], roleCode, panelCount}}
     */
    public Map<String, Object> saveRoleView(String panelCode, String placeKind, List<Map<String, Object>> columns) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String roleCode = currentRoleCode();
        if (roleCode == null) throw new IllegalArgumentException("当前账号未分配角色,无法设置角色视图");
        String kind = placeKind(placeKind);
        if (kind == null) throw new IllegalArgumentException("只支持表头(header)与明细(detail)两类字段:" + placeKind);

        List<PanelRegistry.FieldDef> base = fieldsOf(def, kind);
        String user = currentUserName();
        List<String> skippedRequired = new ArrayList<>();
        // 1) 收集提交的显隐/序号(必填强制显示)
        Map<String, Boolean> shownOf = new LinkedHashMap<>();
        Map<String, Integer> seqOf = new HashMap<>();
        for (Map<String, Object> col : columns == null ? List.<Map<String, Object>>of() : columns) {
            String label = str(col.get("label"));
            PanelRegistry.FieldDef f = base.stream().filter(x -> x.label().equals(label)).findFirst().orElse(null);
            if (f == null) continue;
            boolean want = truthy(col.get("visible"));
            if (!want && f.required()) {
                skippedRequired.add(label);
                want = true;
            }
            shownOf.put(f.col(), want);
            if (want) {
                Integer seq = intOrNull(col.get("seq"));
                if (seq != null) seqOf.put(f.col(), seq);
            }
        }
        // 2) 显示的字段按序号(没号的排末尾、并保持整体顺序)重新压成 1..n,保证"只勾选的才有序号"
        List<String> orderedVisible = new ArrayList<>();
        base.stream().filter(f -> Boolean.TRUE.equals(shownOf.get(f.col())))
                .sorted(Comparator.comparingInt(f -> {
                    Integer s = seqOf.get(f.col());
                    return s == null ? Integer.MAX_VALUE : s;
                }))
                .forEach(f -> orderedVisible.add(f.col()));
        int saved = 0;
        // 2a) 显示的字段:按 1..n 写序号
        for (int i = 0; i < orderedVisible.size(); i++) {
            saved += upsert(panelCode, kind, orderedVisible.get(i), roleCode, true, i + 1, user);
        }
        // 2b) 提交了但没勾选的:「隐藏」也必须留一行(shown=0),否则删行=跟随系统整体,字段又会冒出来
        //     —— 2026-11-13 第二轮实跑踩过:写成删行时,隐藏 单价 后它照旧显示。
        for (PanelRegistry.FieldDef f : base) {
            Boolean submitted = shownOf.get(f.col());
            if (submitted == null) {
                saved += delete(panelCode, kind, f.col(), roleCode);   // 没提交 = 跟随系统整体
            } else if (!submitted) {
                saved += upsert(panelCode, kind, f.col(), roleCode, false, null, user);
            }
        }
        LOG.info("[FIELDVIEW] 保存 panel={} place={} role={} 行 {} 跳过必填 {}",
                panelCode, kind, roleCode, saved, skippedRequired.size());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", saved);
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

    /**
     * 角色模板 · 从系统整体一键复制:把 yj_field 当前的样子(显隐 + 顺序)落成该角色的显式视图。
     * 目的:先"照抄一份",再在上面改,不必从空白开始。
     *
     * @param targetRole 目标角色;空 = 当前账号角色(改自己的角色)
     */
    public Map<String, Object> copyFromSystem(String panelCode, String targetRole) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        String role = resolveTargetRole(targetRole);
        int n = 0;
        jdbc.update("DELETE FROM yj_field_view WHERE role_code = ? AND panel_code = ?", role, panelCode);
        for (String kind : new String[]{"header", "detail"}) {
            List<PanelRegistry.FieldDef> base = fieldsOf(def, kind);
            int seq = 0;
            for (PanelRegistry.FieldDef f : base) {
                boolean shown = baseShown(f, kind) || f.required();
                if (!shown) continue;
                n += upsert(panelCode, kind, f.col(), role, true, ++seq, currentUserName());
            }
        }
        LOG.info("[FIELDVIEW] 从整体复制 panel={} -> role={} 行 {}", panelCode, role, n);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", n);
        out.put("roleCode", role);
        return out;
    }

    /**
     * 角色模板 · 套用到另一个角色(仅管理员):把 fromRole 在该面板的视图整份复制给 toRole。
     */
    public Map<String, Object> copyToRole(String panelCode, String toRole) {
        if (!isAdmin()) throw new IllegalArgumentException("仅管理员可以套用到其他角色");
        String from = currentRoleCode();
        String to = resolveTargetRole(toRole);
        if (from == null) throw new IllegalArgumentException("当前账号未分配角色");
        if (from.equals(to)) throw new IllegalArgumentException("来源与目标角色相同,无需套用");
        List<Object[]> rows = new ArrayList<>();
        jdbc.query("SELECT place_kind, col_name, shown, seq FROM yj_field_view WHERE role_code = ? AND panel_code = ?",
                rs -> {
                    Object seq = rs.getObject(4);
                    rows.add(new Object[]{rs.getString(1), rs.getString(2), rs.getBoolean(3), seq});
                }, from, panelCode);
        if (rows.isEmpty()) throw new IllegalArgumentException("本角色在该面板还没有定制内容,先「从系统整体复制」或直接调整后再套用");
        jdbc.update("DELETE FROM yj_field_view WHERE role_code = ? AND panel_code = ?", to, panelCode);
        for (Object[] r : rows) {
            boolean shown = Boolean.TRUE.equals(r[2]);
            Integer seq = r[3] == null ? null : ((Number) r[3]).intValue();
            upsert(panelCode, String.valueOf(r[0]), String.valueOf(r[1]), to, shown, seq, currentUserName());
        }
        LOG.info("[FIELDVIEW] 套用角色模板 panel={} {} -> {} 行 {}", panelCode, from, to, rows.size());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", rows.size());
        out.put("from", from);
        out.put("to", to);
        return out;
    }

    private String resolveTargetRole(String target) {
        String cur = currentRoleCode();
        if (target == null || target.isBlank() || target.equals(cur)) {
            if (cur == null) throw new IllegalArgumentException("当前账号未分配角色");
            return cur;
        }
        if (!isAdmin()) throw new IllegalArgumentException("仅管理员可以操作其他角色的模板");
        return target;
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

    private int upsert(String panelCode, String kind, String col, String roleCode, boolean shown, Integer seq, String user) {
        int n = jdbc.update("UPDATE yj_field_view SET shown = ?, seq = ?, operator = ?, updated_at = SYSDATETIME()"
                        + " WHERE panel_code = ? AND place_kind = ? AND col_name = ? AND role_code = ?",
                shown, seq, user, panelCode, kind, col, roleCode);
        if (n > 0) return n;
        jdbc.update("INSERT INTO yj_field_view (panel_code, place_kind, col_name, role_code, shown, seq, operator)"
                        + " VALUES (?,?,?,?,?,?,?)",
                panelCode, kind, col, roleCode, shown, seq, user);
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

    private static Integer intOrNull(Object o) {
        if (o == null || "".equals(o)) return null;
        try {
            int v = Integer.parseInt(String.valueOf(o).trim());
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
