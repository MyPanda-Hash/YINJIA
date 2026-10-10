package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 认证相关的数据访问(2026-10-09 分层收敛:原本直写在 AuthController 里)。
 *
 * 只负责"取账号 / 取授权面板 / 口令哈希升级落库"三件事,刻意**不碰**:
 *   · 账套路由(DataSourceRouter.use/clear)——那是请求级上下文,由 Controller 在请求边界开关;
 *   · 令牌签发(JwtUtil)与使用留痕(UsageLogService)——属协议与外部副作用,不是数据访问。
 *
 * 为什么不用 PanelPermissionService 现成的 visiblePanels(user)/到门户的 approverPanels(user):
 * 那两处都从 SecurityContext 取当前账号再查一遍 yj_user;而登录与还原会话时手里**已经拿到了
 * 账号行**(含 role_id),再按 username 回查一次库是多余往返。这里保留按 role_id 入口的同名口径,
 * 二者语义必须永远一致(改动任一侧都要同步另一侧)。
 */
@Service
public class AuthService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    public AuthService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    /** 登录校验用账号行(含口令哈希);不存在返回 null */
    public Map<String, Object> findForLogin(String username) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, password_hash, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 会话还原用账号行(不含口令哈希);不存在返回 null */
    public Map<String, Object> findProfile(String username) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 口令校验:哈希为空或不匹配都算失败(行为等价于原 Controller 的 rows.isEmpty() || !matches) */
    public boolean passwordMatches(String rawPassword, String storedHash) {
        return storedHash != null && encoder.matches(rawPassword, storedHash);
    }

    /**
     * 可见面板(角色口径):管理员=全部("*");普通用户=yj_role_panel 中勾了可见(view)的面板码。
     * 前端 filterMenuTree 据此保留面板叶子,分组节点在子项全不可见时隐藏(= 有可见面板才显示模块)。
     */
    public List<String> visiblePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND perms LIKE '%view%'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /** 审批权限面板:管理员=全部;普通用户=角色勾了审批(面板权限含 audit → can_approve='Y')的面板码 */
    public List<String> approvePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND can_approve = 'Y'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /**
     * 持有指定权限词的面板码(2026-10-09 远端「自定义字段配置权」功能;取数按本地分层口径下沉到本服务)。
     * 取该角色 yj_role_panel.perms 的 csv 逐行**按词**判定 —— 不用 `perms LIKE '%field%'`,
     * 免得日后出现同前缀的词(如 fieldx)被误命中。管理员返回 `*`(= 全部,前端 canConfigFields 认这个通配)。
     */
    public List<String> fieldPanelsOf(boolean admin, Object roleId) {
        return panelsWithPerm(admin, roleId, "field");
    }

    /** 持有指定权限词的面板码(通用实现;权限词见 yj_role_panel.perms 的 csv 约定) */
    public List<String> panelsWithPerm(boolean admin, Object roleId, String word) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code, perms FROM yj_role_panel WHERE role_id = ?",
                (rs, i) -> hasPermWord(rs.getString(2), word) ? rs.getString(1) : null, roleId)
                .stream().filter(java.util.Objects::nonNull).toList();
    }

    /** csv 权限词表是否含某词(trim + 逐词精确匹配;null/空表 = 不含) */
    private static boolean hasPermWord(String perms, String word) {
        if (perms == null || perms.isBlank()) return false;
        for (String p : perms.split(",")) {
            if (word.equals(p.trim())) return true;
        }
        return false;
    }

    /**
     * 过渡期收口:库里的存量哈希若仍是旧格式(BCrypt),借"用户带着明文来登录"这一次机会
     * 重新编码成自写格式写回。BCrypt 不可逆,除此之外没有任何办法拿到明文换算法。
     * 失败绝不影响本次登录(只打日志)——升级是锦上添花,不是登录的前提。
     */
    public void upgradeStoredHashIfNeeded(String username, String rawPassword, String storedHash) {
        try {
            if (storedHash == null || !encoder.upgradeEncoding(storedHash)) return;
            String upgraded = encoder.encode(rawPassword);
            jdbc.update("UPDATE yj_user SET password_hash = ? WHERE username = ?", upgraded, username);
        } catch (RuntimeException e) {
            System.err.println("[login] 存量口令哈希升级失败(不影响本次登录): " + e.getMessage());
        }
    }
}
