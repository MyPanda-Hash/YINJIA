package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 面板权限服务(2026-09-12 服务端强制执行):
 * 此前权限只作用于前端(菜单显隐 + 审批按钮显隐),后端 /api/px/* 对任何登录用户开放——
 * 拿 token 直接调 API 可越权读任意面板数据、改删他人草稿、把他人单据提进审批。
 * 本服务在 PxController/ReportController 入口做服务端校验,与角色面板权限(yj_role_panel.perms)同源。
 *
 * 词表对齐 SysAdminController.PERMISSION_ACTIONS:
 * view 可见 / query 查询单据 / add 新增保存 / modify 申请修改 / modlog 修改记录 /
 * del 删除申请 / export 导出打印 / audit 审批(can_approve = perms 含 audit)。
 *
 * 读权限放行集合 = 可见面板 ∪ 可见面板字段的参照目标(yj_field.ref_panel) ∪ 同模块(module_group)面板。
 * 参照/选单/BOM 勾选/进度表等跨面板读取大量存在(SelectVoucherDialog/RecordSheetPanels/ProgressControlSheet),
 * 只按 view 硬拦会打断合法参照链,故按三层推导放行;跨模块的越权读仍被拦。
 * 因缺失放行而被拦的合法场景,解法是给角色补一个该模块任意面板的「可见」(管理员界面一个勾)。
 */
@Service
public class PanelPermissionService {

    private final JdbcTemplate jdbc;
    private final PanelRegistry registry;

    public PanelPermissionService(JdbcTemplate jdbc, PanelRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    /** 按钮名 → 所需权限(词内任一命中即放行;管理员恒过)。语义对齐权限配置界面的词表注释。 */
    private static final Map<String, String[]> BUTTON_PERMS;
    /** 权限词 → 配置界面标签(错误提示用) */
    private static final Map<String, String> PERM_LABEL = Map.of(
            "view", "可见", "query", "查询单据", "add", "新增保存", "modify", "申请修改",
            "modlog", "修改记录", "del", "删除申请", "export", "导出打印", "audit", "审批");

    static {
        Map<String, String[]> m = new HashMap<>();
        // 只读/查询类(view 即可;方法内自有状态与身份校验)
        for (String b : new String[]{"刷新", "查找", "审批情况", "同步进度", "终止审批通过", "终止审批驳回"})
            m.put(b, new String[]{"view"});
        m.put("修改记录", new String[]{"view", "modlog"});
        // 编辑类(新增保存/申请修改 词表语义)
        String[] edit = {"add", "modify"};
        for (String b : new String[]{"保存", "提交", "保存新增", "保存为草稿", "新增流程", "新增", "复制",
                "阶段完成", "生成产品批号", "新增库存", "更新预警数量", "产品开发", "申请终止"})
            m.put(b, edit);
        m.put("申请修改", new String[]{"modify"});                       // 词表:modify=申请修改
        // 删除类(草稿直删需编辑权;归档单删除申请=del)
        m.put("删除", new String[]{"add", "modify", "del"});
        m.put("删除单据", new String[]{"add", "modify", "del"});
        // 撤回类:发起人(对应申请权限)或审批人(audit);方法内另有发起人/审批人身份校验
        m.put("撤回删除申请", new String[]{"del", "audit"});
        m.put("撤回修改申请", new String[]{"modify", "audit"});
        m.put("撤回终止申请", new String[]{"modify", "audit"});
        // 审批类(audit → can_approve,与 ButtonService.requireApprover 同口径)
        // 「项目定级」= 立项申请审核通过后由审核人给项目定级(2026-09-21),同属审批权动作
        for (String b : new String[]{"审核", "弃审", "提交审批", "审批通过", "审批驳回", "中止", "取消中止",
                "项目定级",
                "删除审批通过", "删除审批驳回", "修改审批通过", "修改审批驳回"})
            m.put(b, new String[]{"audit"});
        BUTTON_PERMS = Map.copyOf(m);
    }

    /**
     * 面板级按钮权限覆盖(默认表之外的口径;管理员恒过)。键 = 「面板编码|按钮名」。
     * 2026-09-21 产品变更申请单:它**不是**文书归档面板(保存不自动送审),所以「提交审批」必须
     * 由**发起人**自己点 —— 而全局表把「提交审批」归到 audit(普通用户没有该词,cp 实测 403),
     * 故本面板改判 add/modify(真正的身份门禁在 ButtonService.requireChangeInitiator:
     * 只有制单人 ∪ 管理员能提交/撤回,别人即使有编辑权也点不动)。
     * 会签类按钮同理:会签人是被指定的普通人(按账号指定即授权),身份校验在方法内。
     */
    private static final Map<String, String[]> BUTTON_PERMS_OVERRIDE = Map.of(
            "RD_CHANGE|提交审批", new String[]{"add", "modify"},
            "RD_CHANGE|提交会签", new String[]{"add", "modify"},
            "RD_CHANGE|撤回会签", new String[]{"add", "modify", "audit"},
            "RD_CHANGE|会签通过", new String[]{"view"},
            "RD_CHANGE|会签驳回", new String[]{"view"});

    /** 按钮权限校验:未映射的按钮放行(由 ButtonService「未定义按钮规则」兜底拦截) */
    public void requireButton(String panelCode, String buttonName) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        String[] need = BUTTON_PERMS_OVERRIDE.get(panelCode + "|" + buttonName);
        if (need == null) need = BUTTON_PERMS.get(buttonName == null ? "" : buttonName);
        if (need == null) return;
        Set<String> perms = permsOf(user).getOrDefault(panelCode, Set.of());
        for (String n : need) if (perms.contains(n)) return;
        StringBuilder labels = new StringBuilder();
        for (String n : need) {
            if (labels.length() > 0) labels.append("/");
            labels.append(PERM_LABEL.getOrDefault(n, n));
        }
        throw new AccessDeniedException("当前角色无该面板「" + labels + "」权限，无法执行「" + buttonName + "」");
    }

    /**
     * 二级审批例外(2026-09-20 两级审批):产品信息表的「审批通过/审批驳回」在**二级节点**上
     * 由一级审核人选定的审核人执行 —— 选取本身就是授权,不要求其角色有 audit 词
     * (否则 cp 这类普通账号点不动第二级,而给它 audit 又会让它越权批一级)。
     * 判据完全落库:yj_doc_status.pending='Y' + approve_node=2 + l2_approver=当前用户。
     */
    public boolean isL2ApproverOf(String panelCode, String targetPanel, String buttonName, Map<String, Object> formData) {
        if (!panelCode.equals(targetPanel)) return false;
        if (!"审批通过".equals(buttonName) && !"审批驳回".equals(buttonName)) return false;
        String no = formData == null || formData.get("编号") == null ? "" : String.valueOf(formData.get("编号")).trim();
        if (no.isEmpty()) return false;
        String user = currentUserName();
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = ? AND doc_no = ? AND pending = 'Y'"
                        + " AND approve_node = 2 AND l2_approver = ?", Integer.class, panelCode, no, user);
        return n != null && n > 0;
    }

    /** 面板查看权限校验(数据读取类接口:列表/单据/审批历史/报表导出) */    public void requirePanelView(String panelCode) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        if (readablePanels(user).contains(panelCode)) return;
        throw new AccessDeniedException("当前角色无该面板的查看权限：" + panelCode);
    }

    /**
     * 面板**读取**权限校验(元数据/配置/个人表格偏好这类入口,2026-09-22 补):
     * 放行集合与 requirePanelView 相同(readablePanels = 可见 ∪ 参照目标 ∪ 同模块),
     * 但**语义分家** —— 前端对"参照面板"也要取配置(business/engine.js 的 refPanel 分支)、
     * 选单目标面板也要取配置(该流程本身已按 view 校验),若这里硬按 view 拦会打断合法参照链。
     *
     * 起因:`GET /px/getPanelConfig` / `getPermMatrix` / `getNewFormPermMatrix` /
     * `saveColumnPrefs` / `saveHeaderPrefs` 此前**完全无闸门** —— 任何登录用户拿 token 就能
     * 取到任意面板的字段结构(与字段级 ref_panel/字典绑定关系),或往任意面板写自己那份表格偏好。
     * 拿不到业务数据,但属于不该开放的面板元数据面。
     */
    public void requirePanelRead(String panelCode) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        if (panelCode == null || panelCode.isBlank()) throw new AccessDeniedException("面板编码不能为空");
        if (readablePanels(user).contains(panelCode)) return;
        throw new AccessDeniedException("当前角色无该面板的读取权限：" + panelCode);
    }

    /** 用户面板权限:panelCode → perms 词集(单角色,但按多行合并兜底) */
    public Map<String, Set<String>> permsOf(String user) {
        Map<String, Set<String>> out = new HashMap<>();
        jdbc.query("SELECT rp.panel_code, rp.perms FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ?",
                rs -> {
                    Set<String> s = out.computeIfAbsent(rs.getString(1), k -> new HashSet<>());
                    String perms = rs.getString(2);
                    if (perms != null) for (String p : perms.split(",")) {
                        String t = p.trim();
                        if (!t.isEmpty()) s.add(t);
                    }
                }, user);
        return out;
    }

    /** 可见面板(perms 含 view) */
    public Set<String> visiblePanels(String user) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT rp.panel_code FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                        + " WHERE u.username = ? AND rp.perms LIKE '%view%'",
                String.class, user));
    }

    /** 读放行集合:可见 ∪ 参照目标(yj_field.ref_panel) ∪ 同模块面板(module_group) */
    public Set<String> readablePanels(String user) {
        Set<String> visible = visiblePanels(user);
        Set<String> out = new HashSet<>(visible);
        for (String p : visible) {
            PanelRegistry.PanelDef def = panelOf(p);
            if (def == null) continue;
            for (PanelRegistry.FieldDef f : def.fields()) {
                if (f.refPanel() != null && !f.refPanel().isBlank()) out.add(f.refPanel().trim());
            }
        }
        Set<String> modules = new HashSet<>();
        for (String p : visible) {
            PanelRegistry.PanelDef def = panelOf(p);
            if (def != null) modules.add(def.moduleName());
        }
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (modules.contains(def.moduleName())) out.add(def.code());
        }
        return out;
    }

    private PanelRegistry.PanelDef panelOf(String code) {
        try {
            return registry.panel(code);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isAdmin(String user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_admin FROM yj_user WHERE username=?", user);
        return !rows.isEmpty() && "Y".equals(String.valueOf(rows.get(0).get("is_admin")));
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }

    /** 当前登录用户必须是管理员,否则 403(报表模板管理等管理动作用) */
    public void requireAdmin() {
        String user = currentUserName();
        if (!isAdmin(user)) throw new org.springframework.security.access.AccessDeniedException("仅管理员可操作");
    }

    /** 当前登录用户在指定面板是否持有任一权限词(管理员恒真;共享文件等自定义模块复用同一词表) */
    public boolean hasAnyPerm(String panelCode, String... words) {
        String user = currentUserName();
        if (isAdmin(user)) return true;
        Set<String> perms = permsOf(user).getOrDefault(panelCode, Set.of());
        for (String w : words) if (perms.contains(w)) return true;
        return false;
    }

    /** 当前登录用户必须是该面板的指定维护人(权限词任一命中,管理员恒过),否则 403 */
    public void requireAnyPerm(String panelCode, String actionLabel, String... words) {
        if (!hasAnyPerm(panelCode, words))
            throw new org.springframework.security.access.AccessDeniedException("仅该面板「" + actionLabel + "」权限的指定人员可操作");
    }
}
