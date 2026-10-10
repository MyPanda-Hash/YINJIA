package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 组织架构服务(部门 / 用户 / 角色 / 角色面板授权):原 SysAdminController 里的 SQL 全部下沉到这里。
 *
 * 下沉理由:Controller 只应做「收参数 → 调服务 → 包 ApiResult」,SQL 写在 Controller 里
 * 会让同一段数据访问无法被其它入口复用,也无法单独加校验/测试。
 * 本服务的语义与异常文案逐条照搬原 Controller,行为不变。
 *
 * 管理员判定口径:yj_user.is_admin = 'Y'。抛 AccessDeniedException(而非真 HTTP 403)是刻意的——
 * GlobalExceptionHandler 会归一成 **HTTP 200 + body code 403**,否则前端 request.js
 * 把 HTTP 403 当认证失效并强制登出,非管理员点一下组织架构就被踢出登录。
 */
@Service
public class SysAdminService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    public SysAdminService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    // ============ 管理员校验 ============

    /** 当前登录账号名(未登录抛 403,不触发前端登出)。 */
    public String currentUsername() {
        String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null) throw new AccessDeniedException("未登录");
        return username;
    }

    public void requireAdmin() {
        requireAdmin("查看使用记录");
    }

    public void requireAdmin(String action) {
        String username = currentUsername();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT is_admin FROM yj_user WHERE username = ?", username);
        boolean admin = !rows.isEmpty() && "Y".equals(rows.get(0).get("is_admin"));
        if (!admin) throw new AccessDeniedException("仅管理员可" + action);
    }

    // ============ 部门 ============

    public List<Map<String, Object>> deptTree() {
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
            else addChild(parent, node);
        }
        return roots;
    }

    @SuppressWarnings("unchecked")
    private void addChild(Map<String, Object> parent, Map<String, Object> node) {
        ((List<Map<String, Object>>) parent.get("children")).add(node);
    }

    public void deptSave(Map<String, Object> body) {
        requireAdmin("维护部门");
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
    }

    public void deptDelete(int id) {
        requireAdmin("维护部门");
        Integer children = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_dept WHERE parent_id = ?", Integer.class, id);
        if (children != null && children > 0) throw new IllegalStateException("存在下级部门，不能删除");
        Integer users = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user WHERE dept_id = ?", Integer.class, id);
        if (users != null && users > 0) throw new IllegalStateException("部门下存在用户，不能删除");
        jdbc.update("DELETE FROM yj_dept WHERE id = ?", id);
    }

    // ============ 用户 ============

    public List<Map<String, Object>> userList() {
        return jdbc.queryForList(
                "SELECT u.id, u.username AS userName, u.real_name AS realName, u.dept_id AS deptId,"
                        + " u.role_id AS roleId, u.enabled, d.dept_name AS deptName, r.role_name AS roleName,"
                        + " ISNULL(u.生产车间, N'') AS workshop,"
                        + " CASE WHEN u.is_admin='Y' THEN 1 ELSE 0 END AS isAdmin"
                        + " FROM yj_user u LEFT JOIN yj_dept d ON d.id = u.dept_id"
                        + " LEFT JOIN yj_role r ON r.id = u.role_id ORDER BY u.id");
    }

    public void userSave(Map<String, Object> body) {
        requireAdmin("维护用户");
        String userName = String.valueOf(body.getOrDefault("userName", "")).trim();
        if (userName.isBlank()) throw new IllegalArgumentException("请输入账号");
        String realName = String.valueOf(body.getOrDefault("realName", "")).trim();
        String password = body.get("password") == null ? "" : String.valueOf(body.get("password"));
        Integer deptId = (Integer) body.get("deptId");
        Integer roleId = (Integer) body.get("roleId");
        String enabled = "0".equals(String.valueOf(body.getOrDefault("enabled", 1))) ? "0" : "1";
        // 生产车间(9.29 批次③「排产界面按车间过滤」):账号车间 → 排产界面只出本车间产线;
        // 空 = 不受限(管理员/计划组照旧看全部)。取值域 = bs_prod_line.生产车间,不做外键(车间是文本派生值)。
        String workshop = body.get("workshop") == null ? null : String.valueOf(body.get("workshop")).trim();
        if (workshop != null && workshop.isBlank()) workshop = null;
        // 权限随角色:仅当所选角色本身就是管理员角色时 is_admin=Y。
        // ⚠ 旧写法把初值写成 "Y"、只在 roleId 非空时才可能改成 "N" —— 于是
        // 「不选角色新建的账号」直接成为系统管理员(2026-09-22 探针实测:id=61/62 两个无角色账号 is_admin=Y)。
        String isAdmin = "N";
        if (roleId != null) {
            List<String> r = jdbc.query(
                    "SELECT is_admin FROM yj_role WHERE id = ?", (rs, i) -> rs.getString(1), roleId);
            isAdmin = (!r.isEmpty() && "Y".equals(r.get(0))) ? "Y" : "N";
        }
        Object id = body.get("id");
        if (id != null && !String.valueOf(id).isBlank()) {
            if (!password.isBlank()) {
                jdbc.update("UPDATE yj_user SET real_name=?, dept_id=?, role_id=?, enabled=?, is_admin=?, 生产车间=?, password_hash=? WHERE id=?",
                        realName, deptId, roleId, enabled, isAdmin, workshop, encoder.encode(password), Integer.parseInt(String.valueOf(id)));
            } else {
                jdbc.update("UPDATE yj_user SET real_name=?, dept_id=?, role_id=?, enabled=?, is_admin=?, 生产车间=? WHERE id=?",
                        realName, deptId, roleId, enabled, isAdmin, workshop, Integer.parseInt(String.valueOf(id)));
            }
        } else {
            if (password.isBlank()) throw new IllegalArgumentException("新建用户必须设置密码");
            Integer dup = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_user WHERE username = ?", Integer.class, userName);
            if (dup != null && dup > 0) throw new IllegalStateException("账号已存在：" + userName);
            jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled, 生产车间)"
                            + " VALUES (?,?,?,?,?,?,?,?)",
                    userName, encoder.encode(password), realName, isAdmin, deptId, roleId, enabled, workshop);
        }
    }

    /** 批量分配角色:给一组用户统一换角色;权限随角色,is_admin 同步角色口径,管理员账号自动跳过 */
    public void userBatchRole(Map<String, Object> body) {
        requireAdmin("维护用户");
        Object idsObj = body.get("userIds");
        Object roleObj = body.get("roleId");
        if (!(idsObj instanceof List<?> ids) || ids.isEmpty()) throw new IllegalArgumentException("请选择用户");
        Integer roleId = roleObj == null || String.valueOf(roleObj).isBlank()
                ? null : Integer.valueOf(String.valueOf(roleObj));
        String isAdmin = "N";
        if (roleId != null) {
            List<String> r = jdbc.query("SELECT is_admin FROM yj_role WHERE id = ?", (rs, i) -> rs.getString(1), roleId);
            if (r.isEmpty()) throw new IllegalArgumentException("角色不存在");
            isAdmin = "Y".equals(r.get(0)) ? "Y" : "N";
        }
        int n = 0;
        for (Object idObj : ids) {
            int userId = Integer.parseInt(String.valueOf(idObj));
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT is_admin FROM yj_user WHERE id = ?", userId);
            if (rows.isEmpty() || "Y".equals(String.valueOf(rows.get(0).get("is_admin")))) continue;
            jdbc.update("UPDATE yj_user SET role_id = ?, is_admin = ? WHERE id = ?", roleId, isAdmin, userId);
            n++;
        }
        if (n == 0) throw new IllegalStateException("没有可分配的用户（管理员账号不参与批量分配）");
    }

    /**
     * 删除账号(物理删除 yj_user 行,仅管理员)。
     *
     * 守卫(顺序有意:先判"删自己"再判"管理员",否则管理员删自己会拿到管理员那条文案):
     *   ① 账号不存在 → 报「账号不存在」(前端列表可能已过期)
     *   ② 删当前登录账号 → 拒绝(防自锁:删掉自己就再也进不来组织架构了)
     *   ③ 管理员账号(is_admin='Y')→ 拒绝(防把最后一个管理员删掉后无人能管组织架构)
     *
     * 为何物理删除是安全的:业务留痕存的是**账号/姓名文本**,不是外键 ——
     *   asp_user1/asp_user2(制单/审核账号)、yj_doc_status.shr、yj_usage_log.username、
     *   yj_form_approval.actor 等全部按 username 存字符串;全库也没有任何外键指向 yj_user。
     *   所以删掉账号行不会破坏历史单据,留下的仍是当时那个人名(审计要求:留痕不随账号消失而抹除)。
     */
    public void userDelete(int id) {
        requireAdmin("维护用户");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, is_admin FROM yj_user WHERE id = ?", id);
        if (rows.isEmpty()) throw new IllegalStateException("账号不存在");
        String target = String.valueOf(rows.get(0).get("username"));
        if (target.equalsIgnoreCase(currentUsername())) {
            throw new IllegalStateException("不能删除当前登录的账号");
        }
        if ("Y".equals(String.valueOf(rows.get(0).get("is_admin")))) {
            throw new IllegalStateException("管理员账号不能删除：" + target);
        }
        jdbc.update("DELETE FROM yj_user WHERE id = ?", id);
    }

    // ============ 角色 ============

    public List<Map<String, Object>> roleList() {
        return jdbc.queryForList(
                "SELECT id, role_code AS roleCode, role_name AS roleName, remark,"
                        + " CASE WHEN is_admin='Y' THEN 1 ELSE 0 END AS isAdmin FROM yj_role ORDER BY id");
    }

    public void roleSave(Map<String, Object> body) {
        requireAdmin("维护角色");
        String code = String.valueOf(body.getOrDefault("roleCode", "")).trim();
        String name = String.valueOf(body.getOrDefault("roleName", "")).trim();
        if (code.isBlank() || name.isBlank()) throw new IllegalArgumentException("请填写角色编码与名称");
        Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_role WHERE role_code = ?", Integer.class, code);
        if (dup != null && dup > 0) throw new IllegalStateException("角色编码已存在：" + code);
        jdbc.update("INSERT INTO yj_role (role_code, role_name, remark, is_admin) VALUES (?,?,?,'N')",
                code, name, String.valueOf(body.getOrDefault("remark", "")));
    }

    public void roleDelete(int id) {
        requireAdmin("维护角色");
        Integer users = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_user WHERE role_id = ?", Integer.class, id);
        if (users != null && users > 0) throw new IllegalStateException("角色下存在用户，先调整用户角色");
        jdbc.update("DELETE FROM yj_role_panel WHERE role_id = ?", id);
        jdbc.update("DELETE FROM yj_role WHERE id = ?", id);
    }

    // ============ 角色面板授权 ============

    /** 该角色已授权的面板([{panelCode, perms}]) */
    public List<Map<String, Object>> grantedPanels(int roleId) {
        return jdbc.queryForList(
                "SELECT panel_code AS panelCode, perms FROM yj_role_panel WHERE role_id = ?", roleId);
    }

    public void saveRolePanels(int roleId, List<Map<String, Object>> panels) {
        requireAdmin("维护角色权限");
        jdbc.update("DELETE FROM yj_role_panel WHERE role_id = ?", roleId);
        for (Map<String, Object> p : panels) {
            String panelCode = String.valueOf(p.getOrDefault("panelCode", ""));
            if (panelCode.isBlank()) continue;
            String perms = String.valueOf(p.getOrDefault("perms", ""));
            jdbc.update("INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve) VALUES (?,?,?,?)",
                    roleId, panelCode, perms, perms.contains("audit") ? "Y" : "N");
        }
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
