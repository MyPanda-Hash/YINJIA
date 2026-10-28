package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.MenuNodeService;
import com.yinjia.mes.service.SysAdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 菜单设计(系统管理平台)—— 用户 2026-10-23 口径「给系统管理模块加上一个菜单命名的功能,就是可以
 * 编辑各个面板的位置与一级模块与二级模块的分支和名字,就不需要每次修改都要重新打包部署」。
 *
 * <p>三个接口:
 * <ul>
 *   <li>{@code GET /api/sys/menu/nodes} —— 覆盖行。**任何登录账号可读**:每个客户端渲染左侧导航都要读它
 *       (空 = 全按代码基线);</li>
 *   <li>{@code POST /api/sys/menu/nodes} —— 整表保存(管理员)。body = 覆盖行数组;</li>
 *   <li>{@code POST /api/sys/menu/reset} —— 清空覆盖、回到代码基线(管理员)。</li>
 * </ul>
 *
 * <p>为什么写接口只有管理员:改一处菜单 = 改全公司所有账号看到的导航,而且隐藏整枝会让某个模块
 * 从界面上"消失"(功能还在,但没人找得到)。与「数据安全/组织架构」同一档权限,不做按角色分级。
 */
@RestController
@RequestMapping("/api/sys/menu")
public class SysMenuController {

    private final MenuNodeService menuNode;
    private final SysAdminService sysAdmin;

    public SysMenuController(MenuNodeService menuNode, SysAdminService sysAdmin) {
        this.menuNode = menuNode;
        this.sysAdmin = sysAdmin;
    }

    /** 覆盖行(登录即可读;空数组 = 未定制,一切按代码基线) */
    @GetMapping("/nodes")
    public ApiResult<Map<String, Object>> nodes() {
        sysAdmin.currentUsername(); // 未登录 ⇒ 403(不触发前端登出)
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("nodes", menuNode.list());
        out.put("count", menuNode.count());
        return ApiResult.ok(out);
    }

    /** 整表保存(管理员)。空数组 = 清回代码基线。 */
    @PostMapping("/nodes")
    public ApiResult<Map<String, Object>> save(@RequestBody List<Map<String, Object>> nodes) {
        sysAdmin.requireAdmin("修改菜单");
        return ApiResult.ok(menuNode.replaceAll(nodes, sysAdmin.currentUsername()));
    }

    /** 恢复代码基线(管理员) */
    @PostMapping("/reset")
    public ApiResult<Map<String, Object>> reset() {
        sysAdmin.requireAdmin("恢复菜单默认");
        return ApiResult.ok(menuNode.reset(sysAdmin.currentUsername()));
    }
}
