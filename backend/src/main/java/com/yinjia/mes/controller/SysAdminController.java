package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
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

    // ============ 角色面板操作权限(12 项) ============

    /** 全部操作权限定义(顺序=前端列顺序)——通用面板 12 项 */
    public static final String[][] PERMISSION_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询"},
            {"add",     "新增"},
            {"edit",    "修改"},
            {"delete",  "删除"},
            {"export",  "导出EXCEL"},
            {"print",   "打印预览"},
            {"audit",   "审核反审核"},
            {"price",   "价格金额"},
            {"review",  "复核反审核"},
            {"adjust",  "调价"},
            // 自定义字段(动态字段/备用列池)配置权(2026-10-09 用户口径):
            // 原先该动作只有超级管理员能做(is_admin 硬判),现在与其余操作同格 ——
            // 在「角色与面板权限」里给哪个面板勾上,该角色就能配那个面板的自定义字段。
            // 服务端同源闸门 = PanelPermissionService.requireFieldConfig(field 词)。
            {"field",   "自定义字段"},
    };

    /** 文件类面板(研发管理·文书式)专属动作集:按真实操作行为设计(新增保存即归档/查询单据/
     *  申请修改闭环/修改记录/删除申请管理员审批/导出打印/审批族/自定义字段),非通用 12 项 */
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
        for (PanelRegistry.PanelDef def : registry.all()) {
            Map<String, Object> p = new LinkedHashMap<>();
            String group = ReportService.navGroup(def.moduleName());
            p.put("panelCode", def.code());
            p.put("panelName", def.name());
            p.put("module", group);
            p.put("hasApproval", def.isDoc());
            // 面板级动作集:文件类面板按真实操作行为下发专属 8 项,其余保持通用 11 项
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
