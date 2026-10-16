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
    /**
     * 权限词 → 配置界面标签(错误提示用)。
     * 后 11 个是**页面级虚拟面板**的专属动作词(2026-10-16,见 {@link PagePanelRegistry}),
     * 与通用 12 项同表 —— 词 → 中文标签一一对应,前端矩阵列头也用同一批中文。
     * ⚠ 2026-10-17 合并 origin/main:main 侧的 `warn`(库存预警数量配置,2026-10-15)并进同一张表;
     *   超过 `Map.of` 的 10 对上限,故一律用 `Map.ofEntries`。
     */
    private static final Map<String, String> PERM_LABEL = Map.ofEntries(
            Map.entry("view", "可见"), Map.entry("query", "查询单据"), Map.entry("add", "新增保存"),
            Map.entry("modify", "申请修改"), Map.entry("modlog", "修改记录"), Map.entry("del", "删除申请"),
            Map.entry("export", "导出打印"), Map.entry("audit", "审批"), Map.entry("field", "自定义字段"),
            Map.entry("warn", "预警配置"),
            Map.entry("date", "修改交期"), Map.entry("convert", "转工单"), Map.entry("assign", "排产"),
            Map.entry("unassign", "撤销排产"), Map.entry("transfer", "调拨"), Map.entry("revoke", "撤回调拨"),
            Map.entry("unclose", "取消结案"), Map.entry("print", "打印"), Map.entry("close", "结案"),
            Map.entry("split", "切单"), Map.entry("picking", "转领料单"));

    static {
        Map<String, String[]> m = new HashMap<>();
        // 只读/查询类(view 即可;方法内自有状态与身份校验)
        for (String b : new String[]{"刷新", "查找", "审批情况", "同步进度", "终止审批通过", "终止审批驳回",
                "完成", "修改", "删除记录"})
            m.put(b, new String[]{"view"});
        m.put("修改记录", new String[]{"view", "modlog"});
        // 编辑类(新增保存/申请修改 词表语义)
        String[] edit = {"add", "modify"};
        for (String b : new String[]{"保存", "提交", "保存新增", "保存为草稿", "新增流程", "新增", "复制",
                "阶段完成", "生成产品批号", "新增库存", "产品开发", "申请终止",
                // 库存状况行内编辑「更新预警数量」(StockWarnService/ButtonService.updateStockWarn):
                // 用户 2026-10-15 改口径 —— **库存状况的预警数量不改权限口径,只有库存明细用 warn**,
                // 故本按钮放回编辑类词表(add/modify),与 warn 词无关。
                "更新预警数量",
                // 生产工单:首件完成通知(置首件标志+通知品质);排产入口=排产工作台(挂"保存"权)。
                // 「生成采购申请」(原 ManuPurchaseReqHandler 按 BOM×排产−库存结转)已随 BOM 下架移除(2026-10-04):
                // 前端已无该按钮,下面的词表条目仅为历史按钮行兜底,不再有对应处理器
                "首件完成通知", "生成采购申请"})
            m.put(b, edit);
        // 库存明细展开区的预警配置(2026-10-15):用户当日改口径 ——
        // **只有库存明细(STOCK_DETAIL)吃「预警配置」(warn)词,库存状况恢复原样(add/modify)**。
        // 库存明细的两个写入口 = 统一设置 POST /api/stock/warn/setAll、
        // 按批次单独设置 POST /api/stock/warn/set,二者共用 StockWarnController 里的
        // requireWarnConfig 闸门 + 同一 warn 词(SysAdminController.PERMISSION_ACTIONS)。
        // ⚠ 下面两条「设置预警数量 / 预警配置」是**库存明细口径的预留按钮名映射**(现网没有同名的按钮行,
        //   未映射的按钮本就放行);保留指向 {"warn"} 是为了将来给库存明细加同名按钮时口径一致。
        m.put("设置预警数量", new String[]{"warn"});
        m.put("预警配置", new String[]{"warn"});
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
     *
     * 2026-10-04 质量单据一族(QC_TC_IN / QC_BHG / QC_BHC / QC_BHZ / QC_JJF / QC_SCP / QC_LYB / QC_SCY)
     * 两级审批:用户口径「编制 = 提交审批的人,审核 = 一级审批通过的人」—— 两者**必须是两个人**,
     * 而全局表让「提交审批」也吃 audit 词,于是只有审核人能提交,编制人恒等于审核人,
     * 且非管理员提交后会被「编制审批分离」挡在审批这一步(死路)。
     * 故这些面板的「提交审批」同产品变更申请单口径改判 add/modify:有该面板新增/申请修改权的人
     * (品质/生产文员)负责编制并提交;「审批通过/审批驳回」仍归 audit(组织架构勾了
     * 「该面板·审核反审核」的角色 ∪ 管理员),第二级再由超级管理员批准。
     */
    private static final Map<String, String[]> BUTTON_PERMS_OVERRIDE;

    /** 「提交审批」在质量单据上的授权词(新增保存 / 申请修改 / 审批 —— 有编辑权就能编制并提交) */
    private static final String[] SUBMIT_WORDS = {"add", "modify", "audit"};

    static {
        Map<String, String[]> m = new HashMap<>();
        m.put("RD_CHANGE|提交审批", new String[]{"add", "modify"});
        m.put("RD_CHANGE|提交会签", new String[]{"add", "modify"});
        m.put("RD_CHANGE|撤回会签", new String[]{"add", "modify", "audit"});
        m.put("RD_CHANGE|会签通过", new String[]{"view"});
        m.put("RD_CHANGE|会签驳回", new String[]{"view"});
        // 质量单据一族(2026-10-04 两级审批):提交审批不再吃 audit 词,见上方注释
        for (String p : new String[]{"QC_TC_IN", "QC_BHG", "QC_BHC", "QC_BHZ",
                "QC_JJF", "QC_SCP", "QC_LYB", "QC_SCY"}) {
            m.put(p + "|提交审批", SUBMIT_WORDS);
        }
        // ── 页面级虚拟面板(2026-10-16):动作词按**页面特性**定义,编码/动作集见 PagePanelRegistry ──
        // 键 = 「页面面板码|按钮名」,按钮名取前端实际使用的文案(与页面上的按钮文字一致,便于对照)。
        m.put(PagePanelRegistry.ORDER_CONVERT + "|保存交期", new String[]{"date"});
        m.put(PagePanelRegistry.ORDER_CONVERT + "|转工单", new String[]{"convert"});
        m.put(PagePanelRegistry.SCHEDULE_BOARD + "|排产", new String[]{"assign"});
        m.put(PagePanelRegistry.SCHEDULE_BOARD + "|预排线", new String[]{"assign"});
        m.put(PagePanelRegistry.SCHEDULE_BOARD + "|撤销排产", new String[]{"unassign"});
        m.put(PagePanelRegistry.WORK_ORDER_BOARD + "|调拨", new String[]{"transfer"});
        m.put(PagePanelRegistry.WORK_ORDER_BOARD + "|撤回调拨", new String[]{"revoke"});
        m.put(PagePanelRegistry.WORK_ORDER_BOARD + "|取消结案", new String[]{"unclose"});
        m.put(PagePanelRegistry.WORK_ORDER_BOARD + "|打印", new String[]{"print"});
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|打印", new String[]{"print"});
        // 生产工单列表:「结案/取消结案」是同一个按钮的两种取向,同挂 close 词;
        // 工单排产看板上的「取消结案」是**另一个**动作(只撤结案不改结案)⇒ 挂 unclose 词。
        // 两者共用一个端点(/px/workOrderList/close),故该端点按 requireButtonAny 取「任一命中」。
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|结案", new String[]{"close"});
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|取消结案", new String[]{"close"});
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|切单", new String[]{"split"});
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|撤回切单", new String[]{"split"});
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|转领料单", new String[]{"picking"});
        // 「排产」两个入口(快速排产页 / 生产工单页弹出的内嵌快速排产)同挂 assign 词:
        // 页面面板各出一个「排产」格子,端点按 requireButtonAny 取任一命中 —— 即"排产权"可由任一处授予。
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|排产", new String[]{"assign"});
        // 预排线(工序路线逐道选线)是「排产」的提交动作,同一 assign 词,两个入口都要登记 ——
        // 只登记 SCHEDULE_BOARD 会让"仅授了生产工单·排产"的角色在内嵌弹窗里被 403(requireButtonAny 逐面板找词)。
        m.put(PagePanelRegistry.WORK_ORDER_LIST + "|预排线", new String[]{"assign"});
        BUTTON_PERMS_OVERRIDE = Map.copyOf(m);
    }

    /** 按钮 → 所需权限词(面板级覆盖优先);null = 未映射(未映射即放行,由 ButtonService 兜底) */
    private static String[] needOf(String panelCode, String buttonName) {
        String[] need = BUTTON_PERMS_OVERRIDE.get(panelCode + "|" + buttonName);
        return need != null ? need : BUTTON_PERMS.get(buttonName == null ? "" : buttonName);
    }

    /** 拒绝提示:把所需权限词翻成配置界面上的中文标签 */
    private static String denyMessage(String[] need, String buttonName) {
        StringBuilder labels = new StringBuilder();
        for (String n : need) {
            if (labels.length() > 0) labels.append("/");
            labels.append(PERM_LABEL.getOrDefault(n, n));
        }
        return "当前角色无该面板「" + labels + "」权限，无法执行「" + buttonName + "」";
    }

    /** 按钮权限校验:未映射的按钮放行(由 ButtonService「未定义按钮规则」兜底拦截) */
    public void requireButton(String panelCode, String buttonName) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        String[] need = needOf(panelCode, buttonName);
        if (need == null) return;
        Set<String> perms = permsOf(user).getOrDefault(panelCode, Set.of());
        for (String n : need) if (perms.contains(n)) return;
        throw new AccessDeniedException(denyMessage(need, buttonName));
    }

    /**
     * 按钮权限校验(**跨面板任一命中**)—— 2026-10-16 页面级面板用:
     * 同一个动作可以由不同页面的入口授予,例如「排产」在快速排产页与生产工单页各有一个按钮;
     * 「打印」在工单排产看板与生产工单列表各有一个;「结案」族由看板的 unclose 与列表的 close 共同覆盖。
     * 任一面板命中即放行;全部未映射(没有任何面板定义过这个按钮)时按"未映射 = 放行"处理。
     */
    public void requireButtonAny(String[] panelCodes, String buttonName) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        Map<String, Set<String>> perms = permsOf(user);
        String[] lastNeed = null;
        for (String code : panelCodes) {
            String[] need = needOf(code, buttonName);
            if (need == null) continue;
            lastNeed = need;
            Set<String> s = perms.getOrDefault(code, Set.of());
            for (String n : need) if (s.contains(n)) return;
        }
        if (lastNeed == null) return;
        throw new AccessDeniedException(denyMessage(lastNeed, buttonName));
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
     * 面板查看权限校验(**任一命中**)—— 2026-10-16 页面级面板用:
     * 有些读接口被多个页面共用(如 /px/scheduleBoard/stats 同时服务快速排产页、
     * 工单排产看板、生产工单页),按单一面板硬拦会把别的页面的合法读取一并挡掉。
     * 任一面板可见即放行;管理员恒过。
     */
    public void requirePanelViewAny(String... panelCodes) {
        String user = currentUserName();
        if (isAdmin(user)) return;
        Set<String> readable = readablePanels(user);
        for (String code : panelCodes) {
            if (readable.contains(code)) return;
        }
        throw new AccessDeniedException("当前角色无该页面的查看权限：" + String.join(" / ", panelCodes));
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

    /** 「自定义字段」权限词(与 SysAdminController.PERMISSION_ACTIONS 的 field 同源) */
    public static final String PERM_FIELD = "field";

    /**
     * 自定义字段(动态字段/备用列池)配置权校验 —— 2026-10-09 用户口径:
     * 「自定义字段需要在组织权限里面能够配置;现在的来料检验要求的自定义字段只要超级管理员能够配置。」
     *
     * 原先 /px/extField/add|retire 是 requireAdmin 硬闸门;现改为**按面板授权**:
     * 组织架构 →「角色与面板权限」里给该面板勾上「自定义字段」的角色即可配置该面板的自定义字段
     * (管理员恒过)。配置本身仍是元数据写入(不改物理列),但会改变全公司看到的面板结构,
     * 故必须逐面板授予、且与按钮权限同一张矩阵(yj_role_panel.perms 的 field 词)。
     */
    public void requireFieldConfig(String panelCode) {
        if (panelCode == null || panelCode.isBlank())
            throw new org.springframework.security.access.AccessDeniedException("面板编码不能为空");
        requireAnyPerm(panelCode, "自定义字段", PERM_FIELD);
    }

    /** 「预警配置」权限词(与 SysAdminController.PERMISSION_ACTIONS 的 warn 同源) */
    public static final String PERM_WARN = "warn";

    /**
     * **库存明细**预警数量配置权校验(2026-10-15 用户改口径,机制同 {@link #requireFieldConfig}):
     * 「只要库存明细可以写就行,库存状况不需要。」
     *
     * <p>即:本闸门**只服务于库存明细(STOCK_DETAIL)**;库存状况(STOCK_STATUS)的行内编辑
     * 「更新预警数量」已恢复 add/modify 口径(见本文件 BUTTON_PERMS 的编辑类词表),
     * 与 warn 词无关。调用方 StockWarnController 已按 panelCode 自行收口(只对 STOCK_DETAIL 调本方法)。
     *
     * <p>库存明细的两个写入口共用本闸门(管理员恒过,普通用户要求该面板 perms 含 warn):
     * <ol>
     *   <li>统一设置所有批次 → StockWarnController POST /api/stock/warn/setAll;</li>
     *   <li>按批次号单独设置 → StockWarnController POST /api/stock/warn/set
     *       (StockWarnService 的业务逻辑不动)。</li>
     * </ol>
     * 配预警只是改 kucun.[预警数量] 这个出库审批拦截阈值,不生成/不改单据,故与 field 词同为
     * 「逐面板授予的配置权」,落在同一张 yj_role_panel.perms 矩阵里。
     */
    public void requireWarnConfig(String panelCode) {
        if (panelCode == null || panelCode.isBlank())
            throw new org.springframework.security.access.AccessDeniedException("面板编码不能为空");
        requireAnyPerm(panelCode, "预警配置", PERM_WARN);
    }
}
