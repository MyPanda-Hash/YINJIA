package com.yinjia.mes.controller;

import com.yinjia.mes.config.DataSourceRouter;
import com.yinjia.mes.config.JwtUtil;
import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.UsageLogService;
import com.yinjia.mes.service.SupplierPortalService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 认证接口(账号存 HSDZ_MES.yj_user,首次启动自动种子 admin/123456) */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate jdbc;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder encoder;
    private final UsageLogService usageLog;
    /** 供应商门户归属(2026-10-24):登录/会话还原时判定"这个账号是不是供应商账号"(见 SupplierPortalService) */
    private final SupplierPortalService supplierPortal;
    /** 本服务器是否提供"测试账套"(yinjia.enable-test-ledger,默认开) */
    private final boolean testLedgerEnabled;

    public AuthController(JdbcTemplate jdbc, JwtUtil jwtUtil, PasswordEncoder encoder, UsageLogService usageLog,
                          SupplierPortalService supplierPortal,
                          @org.springframework.beans.factory.annotation.Value("${yinjia.enable-test-ledger:true}") boolean testLedgerEnabled) {
        this.jdbc = jdbc;
        this.jwtUtil = jwtUtil;
        this.encoder = encoder;
        this.usageLog = usageLog;
        this.supplierPortal = supplierPortal;
        this.testLedgerEnabled = testLedgerEnabled;
    }

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String username = body.getOrDefault("userName", "");
        String password = body.getOrDefault("password", "");
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("用户名和密码不能为空");
        }
        // ADR-0003(一系统两账套):登录页所选工厂决定这次登录**查哪个库** —— 账号与口令两账套各自独立,
        // 且令牌签发时把工厂写进声明,后续请求由 JwtAuthFilter 按声明路由。改选工厂必须重登。
        // ⚠ 本方法走 permitAll、请求上没有 Bearer 令牌,故 JwtAuthFilter 不会代劳设上下文与清理,
        //   必须在这里自己 use() + finally clear()(容器线程复用,不清会把下一次请求带进错误的库)。
        String factory = DataSourceRouter.TEST.equals(body.get("factory"))
                ? DataSourceRouter.TEST : DataSourceRouter.PROD;
        // 本服务器关掉了测试账套(没有 HSDZ_MES_TEST)时**提前拒绝**:否则会走到建连失败,
        // 用户看到的是 "服务异常:Failed to obtain JDBC Connection"(2026-09-22 服务器实测)。
        if (DataSourceRouter.TEST.equals(factory) && !testLedgerEnabled) {
            throw new IllegalArgumentException("本服务器未启用测试账套(如需使用,请让运维在服务端打开 yinjia.enable-test-ledger)");
        }
        DataSourceRouter.use(factory);
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT username, password_hash, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
            if (rows.isEmpty() || !encoder.matches(password, String.valueOf(rows.get(0).get("password_hash")))) {
                throw new IllegalStateException("用户名或密码错误");
            }
            // 过渡期收口:存量 BCrypt 哈希在登录成功时顺手升级成自写格式(
            // BCrypt 不可逆、拿不到明文,只能借"用户自己带明文来登录"这一次机会换掉)
            upgradeStoredHashIfNeeded(username, password, String.valueOf(rows.get(0).get("password_hash")));
            Map<String, Object> u = rows.get(0);
            // 2026-10-24:用户名按库里存的原文对齐(SQL Server 库排序规则不区分大小写,`WHERE username = ?`
            // 可能命中大小写不同的行;下游 SupplierPortalService 按 username 查归属表,必须用原文)
            final String loginName = String.valueOf(u.get("username"));
            boolean admin = "Y".equals(u.get("is_admin"));
            // 使用记录:登录成功事件(失败不记);按所选账套记入对应库
            usageLog.recordLogin(username, String.valueOf(u.get("real_name")), clientIp(request));
            Map<String, Object> user = new HashMap<>();
            user.put("userName", u.get("username"));
            user.put("realName", u.get("real_name"));
            user.put("roleCode", admin ? "admin" : "user");
            user.put("isAdmin", admin);
            user.put("roles", rolesOf(u.get("role_id")));
            user.put("factory", factory);
            // 供应商门户(2026-10-24):账号落在 yj_supplier_account 里 ⇒ **整体降权**,
            // 只留「供应商采购打印」一个可见页面,其余权限清单一律清空(用户口径「没有别的权限」)。
            // 真闸门在 SupplierPortalGuardFilter(供应商会话的 /api 请求只放行门户接口),这里只负责
            // 让前端菜单/路由/桌面按供应商会话重新构建 —— 两者必须同源,改一侧就要同步另一侧。
            String supplierCode = supplierPortal.supplierCodeOf(loginName);
            if (supplierCode != null) {
                user.put("supplierCode", supplierCode);
                user.put("supplierName", supplierCode.isEmpty() ? "" : supplierPortal.supplierName(supplierCode));
                // 页面级面板的只读词(与 PagePanelRegistry.SUPPLIER_PRINT_ACTIONS 同一批词)
                Map<String, Object> pagePerms = new LinkedHashMap<>();
                for (String code : PagePanelRegistry.codes()) pagePerms.put(code, "");
                pagePerms.put(PagePanelRegistry.SUPPLIER_PRINT, "view,query,print");
                user.put("pagePerms", pagePerms);
                user.put("visiblePanels", List.of(PagePanelRegistry.SUPPLIER_PRINT));
                user.put("approvePanels", List.of());
                user.put("fieldPanels", List.of());
                user.put("warnPanels", List.of());
                user.put("roles", List.of("供应商"));
            } else {
                user.put("visiblePanels", visiblePanelsOf(admin, u.get("role_id")));
                // 审批权限面板:管理员=全部;普通用户=角色勾了审批(yj_role_panel.can_approve)的面板
                user.put("approvePanels", approvePanelsOf(admin, u.get("role_id")));
                // 自定义字段配置权限面板(2026-10-09):管理员=全部;普通用户=角色勾了「自定义字段」的面板。
                // 前端据此决定「字段管理 / 自定义字段」入口显不显示;真闸门在服务端
                // PanelPermissionService.requireFieldConfig(同词 = field)。
                user.put("fieldPanels", panelsWithPerm(admin, u.get("role_id"), "field"));
                // 库存预警数量配置权限面板(2026-10-15,同 field 机制):管理员=全部;普通用户=角色勾了「预警配置」的面板。
                // 前端据此决定「预警数量」编辑入口显不显示;真闸门在服务端
                // PanelPermissionService.requireWarnConfig(同词 = warn)。
                user.put("warnPanels", panelsWithPerm(admin, u.get("role_id"), "warn"));
                // 页面级面板权限词(2026-10-16):订单结转/快速排产/工单排产/生产工单四个**看板页面**不是
                // 单据面板,按钮不能走面板元数据(yj_button)—— 由本表下发 code → perms csv,前端 canDo 判显隐;
                // 真闸门在服务端 PanelPermissionService.requirePanelView/requireButton(同一份 yj_role_panel.perms)。
                user.put("pagePerms", pagePermsOf(admin, u.get("role_id")));
            }
            // 供应商权限配置入口(2026-10-25 用户口径「不只是管理员可以来配置,需要能够通过组织架构
            //   添加可以配置的账号」):管理员 ∪ 角色持有 SUPPLIER_ACCOUNT 的 supplier 词。
            //   前端据此显隐菜单/页签;真闸门是 SupplierPortalService.requireAccountConfig(同一句判定)。
            boolean canConfigSupplier = !admin && canConfigSupplierAccount(u.get("role_id"));
            if (canConfigSupplier) {
                // 让前端能看见并进入该页:页面级权限补上「可见」+ supplier 词,导航里才留得住这一条
                Object raw = user.get("pagePerms");
                if (raw instanceof Map<?, ?> m) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> pagePerms = (Map<String, Object>) m;
                    pagePerms.put(PagePanelRegistry.SUPPLIER_ACCOUNT, "view,supplier");
                }
                @SuppressWarnings("unchecked")
                List<Object> vis = user.get("visiblePanels") instanceof List<?> l ? new ArrayList<>(l) : new ArrayList<>();
                vis.add(PagePanelRegistry.SUPPLIER_ACCOUNT);
                user.put("visiblePanels", vis);
            }
            user.put("canConfigSupplierAccount", admin || canConfigSupplier);
            Map<String, Object> out = new HashMap<>();
            out.put("token", jwtUtil.generate(username, factory));
            out.put("user", user);
            return ApiResult.ok(out);
        } finally {
            DataSourceRouter.clear();
        }
    }

    @GetMapping("/perms")
    public ApiResult<Map<String, Object>> perms() {
        Map<String, Object> user = currentUser();
        Map<String, Object> out = new HashMap<>();
        out.put("roleCode", user.get("roleCode"));
        out.put("isAdmin", user.get("isAdmin"));
        out.put("visiblePanels", user.get("visiblePanels"));
        out.put("approvePanels", user.get("approvePanels"));
        out.put("fieldPanels", user.get("fieldPanels"));
        out.put("warnPanels", user.get("warnPanels"));
        out.put("pagePerms", user.get("pagePerms"));
        return ApiResult.ok(out);
    }

    @GetMapping("/userinfo")
    public ApiResult<Map<String, Object>> userinfo() {
        return ApiResult.ok(currentUser());
    }

    /**
     * 用户自助改密(2026-10-15 补)。此前前端 `TopBar.changePwd` 是纯前端假实现:
     * 硬编码 `old !== '123456'` 校验、提示"演示环境不落库",库里一个字节都不动 ——
     * 且除管理员在组织管理里改他人密码外,普通用户**根本没有轮换自己口令的出口**。
     *
     * 账套:本方法走认证请求(JwtAuthFilter 已按令牌声明 DataSourceRouter.use),故无需自己 use/clear。
     */
    @PostMapping("/changePassword")
    public ApiResult<Void> changePassword(@RequestBody Map<String, String> body) {
        String oldPassword = body.getOrDefault("old", "");
        String newPassword = body.getOrDefault("next", "");
        if (oldPassword.isBlank() || newPassword.isBlank()) {
            throw new IllegalArgumentException("原密码和新密码不能为空");
        }
        if (newPassword.length() < 6) {
            throw new IllegalArgumentException("新密码至少 6 位");
        }
        if (newPassword.equals(oldPassword)) {
            throw new IllegalArgumentException("新密码不能与原密码相同");
        }
        String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null) throw new IllegalStateException("未登录");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT password_hash FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty()) throw new IllegalStateException("用户不存在");
        if (!encoder.matches(oldPassword, String.valueOf(rows.get(0).get("password_hash")))) {
            throw new IllegalStateException("原密码不正确");
        }
        jdbc.update("UPDATE yj_user SET password_hash = ? WHERE username = ?", encoder.encode(newPassword), username);
        return ApiResult.ok(null);
    }

    private Map<String, Object> currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication() == null ? null
                : SecurityContextHolder.getContext().getAuthentication().getName();
        if (username == null) throw new IllegalStateException("未登录");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT username, real_name, is_admin, role_id FROM yj_user WHERE username = ?", username);
        if (rows.isEmpty()) throw new IllegalStateException("用户不存在");
        Map<String, Object> u = rows.get(0);
        boolean admin = "Y".equals(u.get("is_admin"));
        Map<String, Object> user = new HashMap<>();
        user.put("userName", u.get("username"));
        user.put("realName", u.get("real_name"));
        user.put("roleCode", admin ? "admin" : "user");
        user.put("isAdmin", admin);
        user.put("roles", rolesOf(u.get("role_id")));
        // 账套(工厂):取自本次请求的线程上下文 —— JwtAuthFilter 按令牌声明设置的,就是"这个请求正在查哪个库"。
        // 2026-09-22 补:原先这里不含 factory,前端启动时用本响应覆盖 mes_user,
        // 会把登录时带进来的 factory 抹掉,顶栏账套名只能靠可能陈旧的 localStorage 缓存 —— 又是"显示与实查不一致"的老坑。
        user.put("factory", DataSourceRouter.current());
        // 供应商会话(2026-10-24):与 {@link #login} **逐字同源** —— 登录时降权、启动时回取也必须降权,
        // 否则"刷新一次页面权限就回来了"(前端的 mes_user 就是被本方法的响应覆盖的)。改一侧必须同步另一侧。
        String supplierCode = supplierPortal.supplierCodeOf(u.get("username") == null ? null : String.valueOf(u.get("username")));
        if (supplierCode != null && !supplierCode.isEmpty()) {
            user.put("supplierCode", supplierCode);
            user.put("supplierName", supplierPortal.supplierName(supplierCode));
            Map<String, Object> pagePerms = new LinkedHashMap<>();
            for (String code : PagePanelRegistry.codes()) pagePerms.put(code, "");
            pagePerms.put(PagePanelRegistry.SUPPLIER_PRINT, "view,query,print");
            user.put("pagePerms", pagePerms);
            user.put("visiblePanels", List.of(PagePanelRegistry.SUPPLIER_PRINT));
            user.put("approvePanels", List.of());
            user.put("fieldPanels", List.of());
            user.put("warnPanels", List.of());
            user.put("roles", List.of("供应商"));
            return user;
        }
        user.put("visiblePanels", visiblePanelsOf(admin, u.get("role_id")));
        user.put("approvePanels", approvePanelsOf(admin, u.get("role_id")));
        user.put("fieldPanels", panelsWithPerm(admin, u.get("role_id"), "field"));
        user.put("warnPanels", panelsWithPerm(admin, u.get("role_id"), "warn"));
        user.put("pagePerms", pagePermsOf(admin, u.get("role_id")));
        // 供应商权限配置(2026-10-25):与 {@link #login} 同源下发,否则刷新页面后入口又消失
        boolean canConfigSupplier = !admin && canConfigSupplierAccount(u.get("role_id"));
        if (canConfigSupplier) {
            Object raw = user.get("pagePerms");
            if (raw instanceof Map<?, ?> m) {
                @SuppressWarnings("unchecked")
                Map<String, Object> pagePerms = (Map<String, Object>) m;
                pagePerms.put(PagePanelRegistry.SUPPLIER_ACCOUNT, "view,supplier");
            }
            @SuppressWarnings("unchecked")
            List<Object> vis = user.get("visiblePanels") instanceof List<?> l ? new ArrayList<>(l) : new ArrayList<>();
            vis.add(PagePanelRegistry.SUPPLIER_ACCOUNT);
            user.put("visiblePanels", vis);
        }
        user.put("canConfigSupplierAccount", admin || canConfigSupplier);
        return user;
    }

    /**
     * 该角色是否持有「供应商权限配置 · 配置供应商账号」词(2026-10-25)。
     * 判定 = yj_role_panel 里 SUPPLIER_ACCOUNT 这一行的 perms 含 `supplier`(逐词精确匹配,
     * 不用 LIKE '%supplier%' 免得将来出现同前缀词被误命中);与
     * SupplierPortalService.requireAccountConfig() 的真闸门**同一口径**。
     */
    private boolean canConfigSupplierAccount(Object roleId) {
        if (roleId == null) return false;
        return panelsWithPerm(false, roleId, SupplierPortalService.PERM_SUPPLIER_ACCOUNT)
                .contains(PagePanelRegistry.SUPPLIER_ACCOUNT);
    }

    /** 角色名(2026-10-18 补)。顶栏「账号信息」弹窗与新的系统管理平台入口页都显示「角色」,
     *  前端读的是 userInfo.roles —— 而登录与 currentUser **两个响应里从来没有下发过这个键**,
     *  于是这一行永远显示「未分配」(误导:看起来像账号没有角色)。
     *  这里按 yj_user.role_id 取 yj_role.role_name;仍返回 List 以兼容前端 roles.join('、')。 */
    private List<String> rolesOf(Object roleId) {
        if (roleId == null) return List.of();
        return jdbc.query("SELECT role_name FROM yj_role WHERE id = ?", (rs, i) -> rs.getString(1), roleId);
    }

    /** 可见面板(角色口径):管理员=全部("*");普通用户=yj_role_panel 中勾了可见(view)的面板码。
     *  前端 filterMenuTree 据此保留面板叶子,分组节点在子项全不可见时隐藏(= 有可见面板才显示模块)。 */
    private List<String> visiblePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND perms LIKE '%view%'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /** 审批权限面板:管理员=全部;普通用户=角色勾了审批(面板权限含 audit → can_approve='Y')的面板码 */
    private List<String> approvePanelsOf(boolean admin, Object roleId) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code FROM yj_role_panel WHERE role_id = ? AND can_approve = 'Y'",
                (rs, i) -> rs.getString(1), roleId);
    }

    /**
     * 持有指定权限词的面板码(2026-10-09):取该角色 yj_role_panel.perms 的 csv 逐行**按词**判定
     * —— 不用 `perms LIKE '%field%'`,免得日后出现同前缀的词(如 fieldx)被误命中。
     * 管理员返回 `*`(= 全部,前端 canConfigFields 认这个通配)。
     */
    private List<String> panelsWithPerm(boolean admin, Object roleId, String word) {
        if (admin) return List.of("*");
        if (roleId == null) return List.of();
        return jdbc.query(
                "SELECT panel_code, perms FROM yj_role_panel WHERE role_id = ?",
                (rs, i) -> hasPermWord(rs.getString(2), word) ? rs.getString(1) : null, roleId)
                .stream().filter(java.util.Objects::nonNull).toList();
    }

    /**
     * 页面级虚拟面板的权限词表(2026-10-16):code → perms csv,只含
     * {@link PagePanelRegistry} 登记的四个看板页面(不把整张权限矩阵发给前端)。
     * 管理员 = 每个页面面板都给 `*`(通配"全部动作",与 fieldPanels 的 admin 口径一致)。
     * 未授权的页面给空串(前端按"拿不到权限 = 不放行"处理,宁可看不到按钮也别点出 403)。
     */
    private Map<String, Object> pagePermsOf(boolean admin, Object roleId) {
        Map<String, String> granted = new HashMap<>();
        if (!admin && roleId != null) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT panel_code, perms FROM yj_role_panel WHERE role_id = ?", roleId)) {
                Object perms = r.get("perms");
                granted.put(String.valueOf(r.get("panel_code")), perms == null ? "" : String.valueOf(perms));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        for (String code : PagePanelRegistry.codes()) {
            out.put(code, admin ? "*" : granted.getOrDefault(code, ""));
        }
        return out;
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
    private void upgradeStoredHashIfNeeded(String username, String rawPassword, String storedHash) {
        try {
            if (!encoder.upgradeEncoding(storedHash)) return;
            String upgraded = encoder.encode(rawPassword);
            jdbc.update("UPDATE yj_user SET password_hash = ? WHERE username = ?", upgraded, username);
        } catch (RuntimeException e) {
            System.err.println("[login] 存量口令哈希升级失败(不影响本次登录): " + e.getMessage());
        }
    }

    /** 客户端 IP(直连内网部署,取 remoteAddr 即可;带代理时取 X-Forwarded-For 首段)。 */
    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
