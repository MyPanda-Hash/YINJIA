package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.UsageLogService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final PanelRegistry registry;
    private final UsageLogService usageLog;

    public SysAdminController(JdbcTemplate jdbc, PasswordEncoder encoder, PanelRegistry registry, UsageLogService usageLog) {
        this.jdbc = jdbc;
        this.encoder = encoder;
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
        requireAdmin();
        return ApiResult.ok(usageLog.query(userName, panelName, actionName, start, end, page, size));
    }

    /** 使用记录按账号分组(admin-only;页面按账号分类展示)。 */
    @GetMapping("/usageLog/grouped")
    public ApiResult<Map<String, Object>> usageLogGrouped(@RequestParam(required = false) String userName,
                                                          @RequestParam(required = false) String panelName,
                                                          @RequestParam(required = false) String actionName,
                                                          @RequestParam(required = false) String start,
                                                          @RequestParam(required = false) String end) {
        requireAdmin();
        return ApiResult.ok(usageLog.queryGrouped(userName, panelName, actionName, start, end));
    }

    /** 当前登录用户须为系统管理员,否则 403。 */
    private void requireAdmin() {
        String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null) throw new AccessDeniedException("未登录");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT is_admin FROM yj_user WHERE username = ?", username);
        boolean admin = !rows.isEmpty() && "Y".equals(rows.get(0).get("is_admin"));
        if (!admin) throw new AccessDeniedException("仅管理员可查看使用记录");
    }

    // ============ 部门 ============

    @GetMapping("/dept/tree")
    @SuppressWarnings("unchecked")
    public ApiResult<List<Map<String, Object>>> deptTree() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, parent_id, dept_name, sort FROM yj_dept ORDER BY sort, id");
        Map<Object, Map<String, Object>> nodes = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", r.get("id"));
            node.put("parentId", r.get("parent_id"));
            node.put("deptName", r.get("dept_name"));
            node.put("children", new ArrayList<Map<String, Object>>());
            nodes.put(r.get("id"), node);
        }
        List<Map<String, Object>> roots = new ArrayList<>();
        for (Map<String, Object> node : nodes.values()) {
            Object pid = node.get("parentId");
            Map<String, Object> parent = nodes.get(pid);
            if (parent == null) roots.add(node);
            else ((List<Map<String, Object>>) parent.get("children")).add(node);
        }
        return ApiResult.ok(roots);
    }

    @PostMapping("/dept/save")
    public ApiResult<Void> deptSave(@RequestBody Map<String, Object> body) {
        String name = String.valueOf(body.getOrDefault("deptName", "")).trim();
        if (name.isBlank()) throw new IllegalArgumentException("请输入部门名称");
        int parentId = parseInt(body.get("parentId"), 0);
        Object id = body.get("id");
        if (id != null && !String.valueOf(id).isBlank()) {
            jdbc.update("UPDATE yj_dept SET parent_id = ?, dept_name = ? WHERE id = ?",
                    parentId, name, Integer.parseInt(String.valueOf(id)));
        } else {
            jdbc.update("INSERT INTO yj_dept (parent_id, dept_name, sort) VALUES (?,?,99)", parentId, name);
        }
        return ApiResult.ok(null);
    }

    @DeleteMapping("/dept/{id}")
    public ApiResult<Void> deptDelete(@PathVariable int id) {
        Integer children = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_dept WHERE parent_id = ?", Integer.class, id);
        if (children != null && children > 0) throw new IllegalStateException("存在下级部门，不能删除");
        Integer users = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user WHERE dept_id = ?", Integer.class, id);
        if (users != null && users > 0) throw new IllegalStateException("部门下存在用户，不能删除");
        jdbc.update("DELETE FROM yj_dept WHERE id = ?", id);
        return ApiResult.ok(null);
    }

    // ============ 用户 ============

    @GetMapping("/user/list")
    public ApiResult<List<Map<String, Object>>> userList() {
        return ApiResult.ok(jdbc.queryForList(
                "SELECT u.id, u.username AS userName, u.real_name AS realName, u.dept_id AS deptId,"
                        + " u.role_id AS roleId, u.enabled, d.dept_name AS deptName, r.role_name AS roleName,"
                        + " CASE WHEN u.is_admin='Y' THEN 1 ELSE 0 END AS isAdmin"
                        + " FROM yj_user u LEFT JOIN yj_dept d ON d.id = u.dept_id"
                        + " LEFT JOIN yj_role r ON r.id = u.role_id ORDER BY u.id"));
    }

    @PostMapping("/user/save")
    public ApiResult<Void> userSave(@RequestBody Map<String, Object> body) {
        String userName = String.valueOf(body.getOrDefault("userName", "")).trim();
        if (userName.isBlank()) throw new IllegalArgumentException("请输入账号");
        String realName = String.valueOf(body.getOrDefault("realName", "")).trim();
        String password = body.get("password") == null ? "" : String.valueOf(body.get("password"));
        Integer deptId = (Integer) body.get("deptId");
        Integer roleId = (Integer) body.get("roleId");
        String enabled = "0".equals(String.valueOf(body.getOrDefault("enabled", 1))) ? "0" : "1";
        // 权限随角色:管理员角色 -> is_admin=Y
        String isAdmin = "Y";
        if (roleId != null) {
            List<String> r = jdbc.query(
                    "SELECT is_admin FROM yj_role WHERE id = ?", (rs, i) -> rs.getString(1), roleId);
            isAdmin = r.isEmpty() || !"Y".equals(r.get(0)) ? "N" : "Y";
        }
        Object id = body.get("id");
        if (id != null && !String.valueOf(id).isBlank()) {
            if (!password.isBlank()) {
                jdbc.update("UPDATE yj_user SET real_name=?, dept_id=?, role_id=?, enabled=?, is_admin=?, password_hash=? WHERE id=?",
                        realName, deptId, roleId, enabled, isAdmin, encoder.encode(password), Integer.parseInt(String.valueOf(id)));
            } else {
                jdbc.update("UPDATE yj_user SET real_name=?, dept_id=?, role_id=?, enabled=?, is_admin=? WHERE id=?",
                        realName, deptId, roleId, enabled, isAdmin, Integer.parseInt(String.valueOf(id)));
            }
        } else {
            if (password.isBlank()) throw new IllegalArgumentException("新建用户必须设置密码");
            Integer dup = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_user WHERE username = ?", Integer.class, userName);
            if (dup != null && dup > 0) throw new IllegalStateException("账号已存在：" + userName);
            jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)"
                            + " VALUES (?,?,?,?,?,?,?)",
                    userName, encoder.encode(password), realName, isAdmin, deptId, roleId, enabled);
        }
        return ApiResult.ok(null);
    }

    // ============ 角色 ============

    @GetMapping("/role/list")
    public ApiResult<List<Map<String, Object>>> roleList() {
        return ApiResult.ok(jdbc.queryForList(
                "SELECT id, role_code AS roleCode, role_name AS roleName, remark,"
                        + " CASE WHEN is_admin='Y' THEN 1 ELSE 0 END AS isAdmin FROM yj_role ORDER BY id"));
    }

    @PostMapping("/role/save")
    public ApiResult<Void> roleSave(@RequestBody Map<String, Object> body) {
        String code = String.valueOf(body.getOrDefault("roleCode", "")).trim();
        String name = String.valueOf(body.getOrDefault("roleName", "")).trim();
        if (code.isBlank() || name.isBlank()) throw new IllegalArgumentException("请填写角色编码与名称");
        Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_role WHERE role_code = ?", Integer.class, code);
        if (dup != null && dup > 0) throw new IllegalStateException("角色编码已存在：" + code);
        jdbc.update("INSERT INTO yj_role (role_code, role_name, remark, is_admin) VALUES (?,?,?,'N')",
                code, name, String.valueOf(body.getOrDefault("remark", "")));
        return ApiResult.ok(null);
    }

    @DeleteMapping("/role/{id}")
    public ApiResult<Void> roleDelete(@PathVariable int id) {
        Integer users = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user WHERE role_id = ?", Integer.class, id);
        if (users != null && users > 0) throw new IllegalStateException("角色下存在用户，先调整用户角色");
        jdbc.update("DELETE FROM yj_role_panel WHERE role_id = ?", id);
        jdbc.update("DELETE FROM yj_role WHERE id = ?", id);
        return ApiResult.ok(null);
    }

    // ============ 角色面板授权 ============

    // ============ 角色面板操作权限(11 项) ============

    /** 全部操作权限定义(顺序=前端列顺序) */
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
            {"review",  "复核反复核"},
            {"adjust",  "调价"},
    };

    @GetMapping("/role/{id}/panels")
    public ApiResult<Map<String, Object>> rolePanels(@PathVariable int id) {
        // 面板按真实模块分组返回(对齐 HSDZ permission.GROP,数据源 yj_panel.module_group)
        Map<String, List<Map<String, Object>>> byModule = new LinkedHashMap<>();
        for (PanelRegistry.PanelDef def : registry.all()) {
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("panelCode", def.code());
            p.put("panelName", def.name());
            p.put("module", def.moduleName());
            p.put("hasApproval", def.isDoc());
            byModule.computeIfAbsent(def.moduleName(), k -> new ArrayList<>()).add(p);
        }
        List<Map<String, Object>> modules = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> e : byModule.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", e.getKey());
            m.put("name", e.getKey());
            m.put("panels", e.getValue());
            modules.add(m);
        }
        List<Map<String, Object>> granted = jdbc.queryForList(
                "SELECT panel_code AS panelCode, perms FROM yj_role_panel WHERE role_id = ?", id);
        Map<String, Object> out = new HashMap<>();
        out.put("modules", modules);
        out.put("allPanels", modules.stream().flatMap(m -> ((List<Map<String, Object>>) m.get("panels")).stream()).toList());
        out.put("granted", granted);
        out.put("actions", PERMISSION_ACTIONS);
        return ApiResult.ok(out);
    }

    @PostMapping("/role/{id}/panels")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> rolePanelsSave(@PathVariable int id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> panels = (List<Map<String, Object>>) body.getOrDefault("panels", List.of());
        jdbc.update("DELETE FROM yj_role_panel WHERE role_id = ?", id);
        for (Map<String, Object> p : panels) {
            String panelCode = String.valueOf(p.getOrDefault("panelCode", ""));
            if (panelCode.isBlank()) continue;
            String perms = String.valueOf(p.getOrDefault("perms", ""));
            jdbc.update("INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve) VALUES (?,?,?,?)",
                    id, panelCode, perms, perms.contains("audit") ? "Y" : "N");
        }
        return ApiResult.ok(null);
    }

    private int parseInt(Object v, int def) {
        if (v == null || String.valueOf(v).isBlank()) return def;
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
