package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.ReportService;
import com.yinjia.mes.service.SysAdminService;
import com.yinjia.mes.service.UsageLogService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 组织架构(照搬 light-mes OrgAdmin 契约):部门树 + 用户 + 角色与面板授权 */
@RestController
@RequestMapping("/api/sys")
public class SysAdminController {

    private final SysAdminService sysAdmin;
    private final PanelRegistry registry;
    private final UsageLogService usageLog;

    public SysAdminController(SysAdminService sysAdmin, PanelRegistry registry, UsageLogService usageLog) {
        this.sysAdmin = sysAdmin;
        this.registry = registry;
        this.usageLog = usageLog;
    }

    // ============ 使用权限查看(仅管理员;CONTEXT.md「使用权限查看」) ============

    /** 使用记录分页查询(登录 + 面板操作),admin-only。 */
    @GetMapping("/usageLog")
    public ApiResult<Map<String, Object>> usageLog(@RequestParam(required = false) String userName,
                                                   @RequestParam(required = false) String panelName,
                                                   @RequestParam(required = false) String actionName,
                                                   @RequestParam(required = false) String start,
                                                   @RequestParam(required = false) String end,
                                                   @RequestParam(defaultValue = "1") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        sysAdmin.requireAdmin();
        return ApiResult.ok(usageLog.query(userName, panelName, actionName, start, end, page, size));
    }

    /** 使用记录按账号分组(admin-only;页面按账号分类展示)。 */
    @GetMapping("/usageLog/grouped")
    public ApiResult<Map<String, Object>> usageLogGrouped(@RequestParam(required = false) String userName,
                                                          @RequestParam(required = false) String panelName,
                                                          @RequestParam(required = false) String actionName,
                                                          @RequestParam(required = false) String start,
                                                          @RequestParam(required = false) String end) {
        sysAdmin.requireAdmin();
        return ApiResult.ok(usageLog.queryGrouped(userName, panelName, actionName, start, end));
    }

    // ============ 部门 ============

    @GetMapping("/dept/tree")
    public ApiResult<List<Map<String, Object>>> deptTree() {
        return ApiResult.ok(sysAdmin.deptTree());
    }

    @PostMapping("/dept/save")
    public ApiResult<Void> deptSave(@RequestBody Map<String, Object> body) {
        sysAdmin.deptSave(body);
        return ApiResult.ok(null);
    }

    @DeleteMapping("/dept/{id}")
    public ApiResult<Void> deptDelete(@PathVariable int id) {
        sysAdmin.deptDelete(id);
        return ApiResult.ok(null);
    }

    // ============ 用户 ============

    @GetMapping("/user/list")
    public ApiResult<List<Map<String, Object>>> userList() {
        return ApiResult.ok(sysAdmin.userList());
    }

    @PostMapping("/user/save")
    public ApiResult<Void> userSave(@RequestBody Map<String, Object> body) {
        sysAdmin.userSave(body);
        return ApiResult.ok(null);
    }

    /** 批量分配角色:给一组用户统一换角色;权限随角色,is_admin 同步角色口径,管理员账号自动跳过 */
    @PostMapping("/user/batch-role")
    public ApiResult<Void> userBatchRole(@RequestBody Map<String, Object> body) {
        sysAdmin.userBatchRole(body);
        return ApiResult.ok(null);
    }

    /** 删除账号(物理删除 yj_user 行,仅管理员);守卫顺序见 {@link SysAdminService#userDelete} */
    @DeleteMapping("/user/{id}")
    public ApiResult<Void> userDelete(@PathVariable int id) {
        sysAdmin.userDelete(id);
        return ApiResult.ok(null);
    }

    // ============ 角色 ============
    @GetMapping("/role/list")
    public ApiResult<List<Map<String, Object>>> roleList() {
        return ApiResult.ok(sysAdmin.roleList());
    }

    @PostMapping("/role/save")
    public ApiResult<Void> roleSave(@RequestBody Map<String, Object> body) {
        sysAdmin.roleSave(body);
        return ApiResult.ok(null);
    }

    @DeleteMapping("/role/{id}")
    public ApiResult<Void> roleDelete(@PathVariable int id) {
        sysAdmin.roleDelete(id);
        return ApiResult.ok(null);
    }

    // ============ 角色面板授权 ============

    // ============ 角色面板操作权限(11 项:引擎真读的词) ============

    /**
     * 全部操作权限定义(顺序=前端列顺序)——通用面板 11 项。
     *
     * <p>🔴 **2026-10-16 词表归位(用户口径:组织架构里研发管理模块角色可配置的权限与面板功能对不上)**:
     * 本表原先给的是 `edit 修改 / delete 删除 / price 价格金额 / review 复核反审核 / adjust 调价`
     * —— 而**引擎一个都不认**。服务端按钮闸门 {@link com.yinjia.mes.service.PanelPermissionService}
     * 只读 `modify 申请修改 / del 删除申请 / modlog 修改记录`(见该文件 BUTTON_PERMS 与 PERM_LABEL)。
     * 后果(2026-10-16 实测,证据 `tools/archive/_rd-perm-audit-20261016/`):
     * <ul>
     *   <li>非文书类面板(生产工单/请购/品质单据/RD_PROGRESS/RD_CHANGE 等)**永远授不出**
     *       「申请修改/删除申请」——界面上只有 edit/delete 可勾,而引擎只看 modify/del ⇒ 勾了也 403;</li>
     *   <li>库里 18 行存着 `edit`、18 行存着 `delete`、各 15 行存着 `price/review/adjust`
     *       —— 这些格子**在矩阵里根本没有列**(通用集没有列头、文件集也没有)⇒ 组织架构界面看不见、
     *       点不掉,却一直待在库里;</li>
     *   <li>反向错位同样存在:库里几十张面板(含采购入库/销售出库/品质一族/其他出入库)已授
     *       `modify/modlog/del`,而通用矩阵只下发 edit/delete/**根本没有这三列**
     *       ⇒ RD_CHANGE 就是典型:库里 `modify,modlog,del` 是真的、界面上却是空白格子;</li>
     *   <li>`price/review/adjust` 全库**零消费者**(任何代码都不读这三个词),纯摆设。</li>
     * </ul>
     * 归位口径:本表 = 引擎真读的词,一概念一词,与 PanelPermissionService.PERM_LABEL 同源
     * (标签逐字取该表,前端列头与后端 403 提示说同一句话)。`edit/delete` 的职责移交
     * `modify/del`(共享文件库 ShareFileService/Controller 的 `add|edit` / `add|edit|delete`
     * 判定同批改为 `add|modify` / `add|modify|del`);`price/review/adjust` 直接撤销。
     * 数据侧由 `tools/migrate-role-perm-words-20261016.sql` 回正(edit→modify、delete→del、删三词)。
     */
    public static final String[][] PERMISSION_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询单据"},
            {"add",     "新增保存"},
            // 申请修改 = 走「申请修改 → 管理员审批 → 改 → 提交审批」的修改闭环(modify 词)。
            // 旧表里的 "edit 修改" 就是这个动作的另一个名字,引擎不认 edit,故统一到 modify。
            {"modify",  "申请修改"},
            {"modlog",  "修改记录"},
            {"del",     "删除申请"},
            {"export",  "导出打印"},
            {"print",   "打印预览"},
            {"audit",   "审批"},
            // 自定义字段(动态字段/备用列池)配置权(2026-10-09 用户口径):
            // 原先该动作只有超级管理员能做(is_admin 硬判),现在与其余操作同格 ——
            // 在「角色与面板权限」里给哪个面板勾上,该角色就能配那个面板的自定义字段。
            // 服务端同源闸门 = PanelPermissionService.requireFieldConfig(field 词)。
            {"field",   "自定义字段"},
            // 库存预警数量配置权(2026-10-15 用户口径,机制同 field 词):
            // 库存状况行内编辑 / 库存明细展开区按批次号设置 kucun.[预警数量] —— 在「角色与面板权限」里
            // 给哪个面板勾上,该角色就能配那个面板的预警数量(只改出库审批的拦截阈值,不动业务单据)。
            // 服务端同源闸门 = PanelPermissionService.requireWarnConfig(warn 词)。
            {"warn",    "预警配置"},
    };

    /**
     * 文件类面板(研发管理·文书式)专属动作集:按真实操作行为设计(新增保存即归档/查询单据/
     * 申请修改闭环/修改记录/删除申请管理员审批/导出打印/审批族/自定义字段)。
     * 相对通用 11 项只少 `print`(文书式面板没有打印按钮)与 `warn`(不涉及库存预警阈值)
     * —— **子集关系**由 `frontend/src/core/auth/permWordDrift.test.js` 钉住,防止再分叉出第二套词。
     */
    public static final String[][] FILE_PANEL_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询单据"},
            {"add",     "新增保存"},
            {"modify",  "申请修改"},
            {"modlog",  "修改记录"},
            {"del",     "删除申请"},
            {"export",  "导出打印"},
            {"audit",   "审批"},
            {"field",   "自定义字段"},
    };

    @GetMapping("/role/{id}/panels")
    public ApiResult<Map<String, Object>> rolePanels(@PathVariable int id) {
        // 面板按真实模块分组返回(对齐 HSDZ permission.GROP,数据源 yj_panel.module_group)
        // 分组名经 ReportService.navGroup 归并到导航一级模块(历史碎组:基础资料/采购管理/订单管理/生产管理/委外加工/库存核算 → 对应导航模块),
        // 未归并的原值原样保留;库中 module_group 原列不动,读权限放行口径不受影响。
        Map<String, List<Map<String, Object>>> byModule = new LinkedHashMap<>();
        // 通用虚拟面板:我的桌面权限化(勾可见才在导航显示;admin 恒可见)
        Map<String, Object> dash = new LinkedHashMap<>();
        dash.put("panelCode", "DASHBOARD");
        dash.put("panelName", "我的桌面");
        dash.put("module", "我的桌面");
        dash.put("hasApproval", false);
        dash.put("actions", new String[][]{{"view", "可见"}});
        byModule.computeIfAbsent("我的桌面", k -> new ArrayList<>()).add(dash);
        // 页面级虚拟面板(2026-10-16):订单结转 / 快速排产 / 工单排产 / 生产工单列表。
        // 这四个界面**不是单据面板**(无 yj_panel 行,数据来自 plang / plang_pc / bl_so_order),
        // 此前在矩阵里无从勾选 ⇒ 任何登录账号都能看到并进入(菜单无 panelCode 时 filterMenuTree 放行)。
        // 与 DASHBOARD 同一先例:不插 yj_panel 行(避免污染报表/选单/字段配置等 registry.all() 下游),
        // 授权照旧落 yj_role_panel;动作集按页面特性裁剪 —— 定义与理由见 PagePanelRegistry。
        for (PagePanelRegistry.PagePanelDef def : PagePanelRegistry.ALL) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("panelCode", def.code());
            p.put("panelName", def.name());
            p.put("module", def.module());
            p.put("hasApproval", false);
            p.put("actions", def.actions());
            byModule.computeIfAbsent(def.module(), k -> new ArrayList<>()).add(p);
        }
        for (PanelRegistry.PanelDef def : registry.all()) {
            Map<String, Object> p = new LinkedHashMap<>();
            String group = ReportService.navGroup(def.moduleName());
            p.put("panelCode", def.code());
            p.put("panelName", def.name());
            p.put("module", group);
            p.put("hasApproval", def.isDoc());
            // 面板级动作集:文件类面板按真实操作行为下发专属 8 项,其余保持通用 13 项
            // (warn「预警配置」只进通用集:它作用于库存 kucun.[预警数量] 阈值,RD_* 文书式面板没有该动作)
            p.put("actions", ButtonService.DOC_ARCHIVE_PANELS.contains(def.code())
                    ? FILE_PANEL_ACTIONS : PERMISSION_ACTIONS);
            byModule.computeIfAbsent(group, k -> new ArrayList<>()).add(p);
        }
        List<Map<String, Object>> modules = new ArrayList<>();
        // 按导航一级模块顺序输出(未登记模块按发现顺序排在末尾),前端即按此顺序渲染分组
        for (String nav : ReportService.NAV_GROUP_ORDER) {
            List<Map<String, Object>> panels = byModule.remove(nav);
            if (panels == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", nav);
            m.put("name", nav);
            m.put("panels", panels);
            modules.add(m);
        }
        for (Map.Entry<String, List<Map<String, Object>>> e : byModule.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", e.getKey());
            m.put("name", e.getKey());
            m.put("panels", e.getValue());
            modules.add(m);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("modules", modules);
        out.put("allPanels", modules.stream().flatMap(m -> ((List<Map<String, Object>>) m.get("panels")).stream()).toList());
        out.put("granted", sysAdmin.grantedPanels(id));
        out.put("actions", PERMISSION_ACTIONS);
        // 只读计数:矩阵里来自 yj_panel 的在册面板数 + 虚拟面板数(DASHBOARD + PagePanelRegistry.ALL)。
        // 给 tools/verify/perm-groups.cjs 当"不重不漏"的真值用 —— 原先那里写死 153,面板一增就与库不符、
        // 闸门常年红(2026-10-20 合并 origin/main 时发现)。这里现算,不再需要手工同步魔法数字。
        int yjRegistered = registry.all().size();
        int virtualPanels = 1 + PagePanelRegistry.ALL.size();   // DASHBOARD + 页面级
        out.put("panelCounts", Map.of(
                "yjRegistered", yjRegistered,
                "virtual", virtualPanels,
                "expected", yjRegistered + virtualPanels));
        return ApiResult.ok(out);
    }

    @PostMapping("/role/{id}/panels")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> rolePanelsSave(@PathVariable int id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> panels = (List<Map<String, Object>>) body.getOrDefault("panels", List.of());
        sysAdmin.saveRolePanels(id, panels);
        return ApiResult.ok(null);
    }
}
