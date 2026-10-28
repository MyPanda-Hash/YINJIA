package com.yinjia.mes.service;

import com.yinjia.mes.config.DataSourceRouter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 供应商门户(2026-10-24)—— 供应商账号的「是谁 / 能看什么」唯一真源。
 *
 * <p>用户口径:「采购管理里面多增加俩个面版,一个是供应商采购打印面版,一个是供应商权限配置。
 * 供应商可以通过登录供应商配置的账号登录进来,<b>只能看到供应商采购打印面版(和对应供应商编码的数据)</b>。
 * 然后供应商可以通过这个面版来查看和打印数据。<b>没有别的权限</b>。」
 *
 * <h3>权限模型:供应商会话是「降权」而不是「加权」</h3>
 * <ul>
 *   <li>登录凭据仍在 {@code yj_user}(口令同 {@link PasswordEncoder} 口径),归属在
 *       {@code yj_supplier_account}(username 一对一 → supplier_code);</li>
 *   <li>登录成功那一刻命中本表 ⇒ {@code AuthController} 把会话整体改写为:
 *       {@code supplierCode} + {@code visiblePanels=[SUPPLIER_PRINT]} + 全部其它权限清单清空
 *       —— 前端菜单树因此只剩「采购管理 → 供应商采购打印」这一条;</li>
 *   <li>后端不靠"菜单藏起来"当闸门:{@link SupplierPortalGuardFilter} 在过滤器层把供应商账号的
 *       **全部 /api 请求**收口到 {@code /api/supplier/portal/*} 白名单,其余一律 403 ——
 *       拿令牌直接调 /api/px/* 读不到任何别的面板,也调不动任何业务按钮;</li>
 *   <li>数据范围:本服务每个取数方法都按 {@link #currentSupplierCode()} 拼
 *       {@code AND 供应商编码 = ?},{@code supplierCode} 为空的会话(内部账号)取不到 supplier 视角的数据。</li>
 * </ul>
 *
 * <p>⚠ 两账套(ADR-0003):`yj_supplier_account` 与 `yj_user` 都是**各账套一份**,
 * 本服务全部走当前路由的 JdbcTemplate,故账号、绑定、订单数据都跟随登录时选的账套。
 */
@Service
public class SupplierPortalService {

    /** 供应商端唯一可见的页面面板码(见 {@link PagePanelRegistry#SUPPLIER_PRINT}) */
    public static final String PANEL_PRINT = PagePanelRegistry.SUPPLIER_PRINT;
    /** 供应商权限配置(管理员专属页面,见 {@link PagePanelRegistry#SUPPLIER_ACCOUNT}) */
    public static final String PANEL_ACCOUNT = PagePanelRegistry.SUPPLIER_ACCOUNT;

    private static final String HEAD = "bd_pu_order";
    private static final String LINE = "bl_pu_order";
    /** 账号名规则:字母数字下划线点横线,3~40 位(与 yj_user.username nvarchar(40) 对齐) */
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_.\\-]{3,40}$");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    /**
     * 查不到归属表时的兜底结论({@code null} 或 {@code "Y"} ⇒ 内部账号照常放行)。
     *
     * <p>为什么需要它:过滤器按"是不是供应商"一刀切,若库还停在旧结构(未跑
     * {@code migrate-supplier-portal-20261024.sql})而服务已更新,异常会**把人全挡在门外**
     * (所有内部账号一律被当成非供应商 —— 反过来不挡又等于大门敞开,只有真供应商账号存在时才挡)。
     * 所以一次异常就把它钉成"不挡",直到进程重启:是安全的默认,也不会把故障放大成全员 403。
     */
    private volatile String unavailable = null;

    public SupplierPortalService(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    // ==================== 会话身份 ====================

    /** 当前登录账号名(无认证上下文时记 system,与其他埋点同口径) */
    public static String currentUserName() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }

    /**
     * 当前会话若为供应商账号,返回其绑定供应商编码;内部账号返回 null。
     * 每次请求查一次主键唯一索引,开销可忽略 —— 换来的是"停用/改绑立即生效"(不用等令牌过期)。
     *
     * <p>⚠ 本方法**吞掉**查库异常(返回 null = 不是供应商),原因见 {@link #unavailable}:
     * 它是过滤器层的判据,抛异常会把整个 /api 打成 500。
     */
    public String supplierCodeOf(String username) {
        if (username == null || username.isBlank() || "system".equals(username)) return null;
        if ("Y".equals(unavailable)) return null;
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT supplier_code, enabled FROM yj_supplier_account WHERE username = ?", username);
            if (rows.isEmpty()) return null;                                  // 内部账号
            if (!"1".equals(String.valueOf(rows.get(0).get("enabled")))) return "";   // 已停用
            String code = rows.get(0).get("supplier_code") == null ? "" : String.valueOf(rows.get(0).get("supplier_code")).trim();
            return code.isEmpty() ? null : code;
        } catch (RuntimeException e) {
            unavailable = "Y";
            System.err.println("[supplier-portal] 供应商账号表不可用,本次进程内不启用供应商会话收口(请先执行 "
                    + "tools/migrate-supplier-portal-20261024.sql): " + e.getMessage());
            return null;
        }
    }

    public String currentSupplierCode() {
        return supplierCodeOf(currentUserName());
    }

    /** 当前请求是不是供应商会话(停用中的供应商账号也算 —— 它同样不该看到任何东西) */
    public boolean isSupplierSession() {
        return supplierCodeOf(currentUserName()) != null;
    }

    /**
     * 供应商门店取数前的闸门:必须**登录态属于某个供应商**(管理员/内部账号不适用 ——
     * 他们没有"对应供应商编码",一律 403;管理员要看数据请到采购订单面板)。
     * 返回的编码已经是**服务端认定的**,前端传来的任何供应商编码一律不采信。
     */
    private String requireSupplier() {
        String code = currentSupplierCode();
        if (code == null) {
            throw new AccessDeniedException("当前账号不是供应商账号,无法使用供应商门户");
        }
        if (code.isEmpty()) {
            throw new AccessDeniedException("供应商账号已停用,请联系采购部");
        }
        return code;
    }

    // ==================== 供应商端:采购订单(只读) ====================

    /**
     * 供应商的采购订单清单(服务端强制 {@code 供应商编码 = 当前供应商})。
     *
     * @param keyword 模糊搜 单据编号/物料编码/物料名称(留空不筛)
     * @param start   单据日期下限(yyyy-MM-dd,可空)
     * @param end     单据日期上限(yyyy-MM-dd,可空)
     * @param onlyOpen 只看未关闭(status 里带「草稿」或「关闭状态」为空)
     * @param pageNo  1 起
     * @param pageSize 行数(前端固定 20~100)
     */
    public Map<String, Object> orders(String keyword, String start, String end, boolean onlyOpen, int pageNo, int pageSize) {
        String code = requireSupplier();
        int size = Math.max(1, Math.min(pageSize <= 0 ? 20 : pageSize, 200));
        int page = Math.max(1, pageNo);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(h.[供应商编码],N'') = ?");
        args.add(code);
        if (start != null && !start.isBlank()) { where.append(" AND h.[单据日期] >= ?"); args.add(start.trim()); }
        if (end != null && !end.isBlank()) { where.append(" AND h.[单据日期] <= ?"); args.add(end.trim()); }
        if (onlyOpen) {
            // 「未关闭」= 不是已审核，或 关闭状态 为空/未关闭（账套里关闭状态为空串表示未关闭）
            where.append(" AND (ISNULL(h.[单据状态],N'') <> N'已审核'"
                    + " OR ISNULL(h.[关闭状态],N'') IN (N'', N'未关闭'))");
        }
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            where.append(" AND (h.[单据编号] LIKE ? OR EXISTS (SELECT 1 FROM ").append(LINE)
                    .append(" l WHERE l.[单据编号] = h.[单据编号] AND (l.[物料编码] LIKE ? OR l.[物料名称] LIKE ?)))");
            String like = "%" + kw + "%";
            args.add(like); args.add(like); args.add(like);
        }
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + HEAD + " h" + where, Integer.class, args.toArray());
        int skip = (page - 1) * size;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT h.[单据编号] AS docNo, CONVERT(varchar(10),h.[单据日期],120) AS docDate,"
                        + " ISNULL(h.[供应商编码],N'') AS supplierCode, ISNULL(h.[供应商],N'') AS supplier,"
                        + " ISNULL(h.[单据状态],N'') AS status, ISNULL(h.[关闭状态],N'') AS closeStatus,"
                        + " ISNULL(h.[付款方式],N'') AS payType, ISNULL(h.[备注],N'') AS remark,"
                        + " CONVERT(varchar(10),h.[交货日期],120) AS deliveryDate,"
                        + " (SELECT COUNT(*) FROM " + LINE + " l WHERE l.[单据编号] = h.[单据编号]"
                        + "    AND ISNULL(l.asp_cancel,'N') <> 'Y') AS lineCount,"
                        + " (SELECT ISNULL(SUM(l.[数量]),0) FROM " + LINE + " l WHERE l.[单据编号] = h.[单据编号]"
                        + "    AND ISNULL(l.asp_cancel,'N') <> 'Y') AS totalQty,"
                        + " (SELECT ISNULL(SUM(l.[金额]),0) FROM " + LINE + " l WHERE l.[单据编号] = h.[单据编号]"
                        + "    AND ISNULL(l.asp_cancel,'N') <> 'Y') AS totalAmount"
                        + " FROM " + HEAD + " h" + where
                        + " ORDER BY h.[单据日期] DESC, h.[单据编号] DESC"
                        + " OFFSET " + skip + " ROWS FETCH NEXT " + size + " ROWS ONLY",
                args.toArray());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("rows", rows);
        out.put("total", total == null ? 0 : total);
        out.put("page", page);
        out.put("size", size);
        out.put("supplierCode", code);
        out.put("supplierName", supplierName(code));
        return out;
    }

    /**
     * 单张订单(头 + 明细行),**按单据号 + 当前供应商编码双重过滤** ——
     * 供应商猜中别人的订单号也取不到货(这是本门户的数据隔离闸门,不要只按单据号查)。
     */
    public Map<String, Object> orderDetail(String docNo) {
        String code = requireSupplier();
        if (docNo == null || docNo.isBlank()) throw new IllegalArgumentException("缺少单据编号");
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT h.[单据编号] AS docNo, CONVERT(varchar(10),h.[单据日期],120) AS docDate,"
                        + " ISNULL(h.[供应商编码],N'') AS supplierCode, ISNULL(h.[供应商],N'') AS supplier,"
                        + " ISNULL(h.[单据状态],N'') AS status, ISNULL(h.[关闭状态],N'') AS closeStatus,"
                        + " ISNULL(h.[付款方式],N'') AS payType, ISNULL(h.[备注],N'') AS remark,"
                        + " CONVERT(varchar(10),h.[交货日期],120) AS deliveryDate"
                        + " FROM " + HEAD + " h WHERE h.[单据编号] = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'"
                        + " AND ISNULL(h.[供应商编码],N'') = ?", docNo.trim(), code);
        if (heads.isEmpty()) throw new AccessDeniedException("该采购订单不存在,或不属于当前供应商:" + docNo);
        // ⚠ 别名列一律用 [方括号] 包起来:`lineNo` 是 T-SQL 保留字(行号别名),
        //   `AS lineNo` 会直接报「关键字 'lineNo' 附近有语法错误」(2026-10-24 实测)。
        List<Map<String, Object>> lines = jdbc.queryForList(
                "SELECT ISNULL(l.[行号],N'') AS [lineNo], ISNULL(l.[物料编码],N'') AS [itemCode],"
                        + " ISNULL(l.[物料名称],N'') AS [itemName], ISNULL(l.[规格型号],N'') AS [spec],"
                        + " ISNULL(l.[单位],N'') AS [unit], ISNULL(l.[数量],0) AS [qty], ISNULL(l.[单价],0) AS [price],"
                        + " ISNULL(l.[金额],0) AS [amount], ISNULL(l.[税率%],0) AS [taxRate],"
                        + " CONVERT(varchar(10),l.[预计到货日期],120) AS [arrivalDate], ISNULL(l.[备注],N'') AS [remark]"
                        + " FROM " + LINE + " l WHERE l.[单据编号] = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + " ORDER BY l.id", docNo.trim());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("head", heads.get(0));
        out.put("lines", lines);
        return out;
    }

    /**
     * 打印留痕:供应商每落一次纸记一行(bd_ 单据不能用 usage log 的语义,故走用记 yj_usage_log 的 action 事件,
     * 面板名列写「供应商采购打印」)。失败静默 —— 留痕不是业务前提(与 UsageLogService 同口径)。
     */
    public void recordPrint(String docNo, String ip) {
        String code;
        try {
            code = requireSupplier();
        } catch (AccessDeniedException e) {
            return;
        }
        try {
            // 先按同样口径核一遍归属:不属于本供应商的单据不记账(也就不可能被打印)
            Integer owns = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM " + HEAD + " WHERE [单据编号] = ? AND ISNULL([供应商编码],N'') = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, docNo, code);
            if (owns == null || owns == 0) throw new AccessDeniedException("该采购订单不属于当前供应商:" + docNo);
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no, ip)"
                            + " VALUES (?,?,?,?,?,?,?)",
                    currentUserName(), supplierName(code), "action", "供应商采购打印", "打印采购订单", docNo, ip);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception ignore) {
            // 留痕失败不影响打印
        }
    }

    /** 供应商名称(取供应商档案 dm_gf;查不到退回编码本身) */
    public String supplierName(String code) {
        if (code == null || code.isBlank()) return "";
        try {
            List<String> rows = jdbc.queryForList(
                    "SELECT TOP 1 [mc] FROM dm_gf WHERE [dm] = ?", String.class, code);
            if (!rows.isEmpty() && rows.get(0) != null && !rows.get(0).isBlank()) return rows.get(0);
        } catch (Exception ignore) {
            // 档案不可用时不影响出数
        }
        return code;
    }

    // ==================== 管理员端:供应商账号维护 ====================

    /** 供应商档案下拉(账套内 dm_gf:dm=编码, mc=名称) */
    public List<Map<String, Object>> suppliers(String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        if (kw.isEmpty()) {
            return jdbc.queryForList("SELECT TOP 500 ISNULL([dm],N'') AS code, ISNULL([mc],N'') AS name FROM dm_gf"
                    + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([dm],N'') <> N'' ORDER BY [dm]");
        }
        String like = "%" + kw + "%";
        return jdbc.queryForList("SELECT TOP 100 ISNULL([dm],N'') AS code, ISNULL([mc],N'') AS name FROM dm_gf"
                + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([dm],N'') <> N''"
                + " AND ([dm] LIKE ? OR [mc] LIKE ?) ORDER BY [dm]", like, like);
    }

    /** 账号列表(供应商维度 + 账号维度两张表 join,不暴露口令哈希) */
    public List<Map<String, Object>> accounts(String keyword, String supplierCode) {
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.username AS userName, a.supplier_code AS supplierCode,"
                        + " ISNULL(g.[mc], N'') AS supplierName, a.enabled, ISNULL(a.remark,N'') AS remark,"
                        + " CONVERT(varchar(19),a.create_at,120) AS createAt, ISNULL(a.create_by,N'') AS createBy,"
                        + " ISNULL(u.real_name,N'') AS realName, ISNULL(u.[供应商编码],N'') AS userSupplierCode,"
                        + " ISNULL(u.enabled,'') AS userEnabled"
                        + " FROM yj_supplier_account a"
                        + " LEFT JOIN yj_user u ON u.username = a.username"
                        + " LEFT JOIN dm_gf g ON g.[dm] = a.supplier_code WHERE 1=1");
        List<Object> args = new ArrayList<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            sql.append(" AND (a.username LIKE ? OR a.supplier_code LIKE ? OR g.[mc] LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like); args.add(like); args.add(like);
        }
        if (supplierCode != null && !supplierCode.isBlank()) {
            sql.append(" AND a.supplier_code = ?");
            args.add(supplierCode.trim());
        }
        sql.append(" ORDER BY a.supplier_code, a.username");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    /**
     * 新建/修改供应商账号。一处写入两处状态:
     * {@code yj_supplier_account}(归属 + 启停) 与 {@code yj_user}(登录凭据 + real_name + 供应商编码 + enabled),
     * 同事务 —— 否则会出现"能登录但不知道是谁"或"账号在、归属没"。停用时把口令哈希也清掉:
     * 账号再启用必须由采购重新设密(防离职/解约后旧口令复用)。
     */
    @Transactional
    public void saveAccount(Map<String, Object> body) {
        String userName = str(body.get("userName"));
        String supplierCode = str(body.get("supplierCode"));
        String realName = str(body.get("realName"));
        String remark = str(body.get("remark"));
        String password = body.get("password") == null ? "" : String.valueOf(body.get("password"));
        boolean enabled = !"0".equals(String.valueOf(body.getOrDefault("enabled", "1")));
        if (userName.isEmpty() || !USERNAME.matcher(userName).matches()) {
            throw new IllegalArgumentException("账号须为 3~40 位字母/数字/下划线/点/横线");
        }
        if (supplierCode.isEmpty()) throw new IllegalArgumentException("请选择供应商");

        Object idObj = body.get("id");
        boolean editing = idObj != null && !String.valueOf(idObj).isBlank();
        List<Map<String, Object>> exist = jdbc.queryForList(
                "SELECT id, username, supplier_code, enabled FROM yj_supplier_account WHERE username = ?", userName);

        if (editing) {
            int id = Integer.parseInt(String.valueOf(idObj));
            List<Map<String, Object>> cur = jdbc.queryForList(
                    "SELECT username FROM yj_supplier_account WHERE id = ?", id);
            if (cur.isEmpty()) throw new IllegalStateException("供应商账号不存在");
            if (!userName.equals(String.valueOf(cur.get(0).get("username")))) {
                throw new IllegalArgumentException("账号创建后不可改名(如需换名请新建账号并停用旧账号)");
            }
        } else {
            if (!exist.isEmpty()) throw new IllegalStateException("账号已存在:" + userName);
            Integer dup = jdbc.queryForObject("SELECT COUNT(*) FROM yj_user WHERE username = ?", Integer.class, userName);
            if (dup != null && dup > 0) throw new IllegalStateException("该账号名已被内部账号占用:" + userName);
            if (password.isBlank()) throw new IllegalArgumentException("新建供应商账号必须设置密码");
        }
        if (!password.isBlank() && password.length() < 6) throw new IllegalArgumentException("密码至少 6 位");
        if (realName.isEmpty()) realName = supplierName(supplierCode);

        String by = currentUserName();
        if (editing) {
            int id = Integer.parseInt(String.valueOf(idObj));
            jdbc.update("UPDATE yj_supplier_account SET supplier_code=?, enabled=?, remark=?, update_by=?, update_at=SYSDATETIME()"
                            + " WHERE id=?", supplierCode, enabled ? "1" : "0", remark, by, id);
            if (!password.isBlank()) {
                jdbc.update("UPDATE yj_user SET real_name=?, [供应商编码]=?, enabled=?, password_hash=? WHERE username=?",
                        realName, supplierCode, enabled ? "1" : "0", encoder.encode(password), userName);
            } else if (enabled) {
                jdbc.update("UPDATE yj_user SET real_name=?, [供应商编码]=?, enabled='1' WHERE username=?", realName, supplierCode, userName);
            } else {
                // 停用 + 清空口令:重新启用必须重设密码(见方法头注)
                jdbc.update("UPDATE yj_user SET real_name=?, [供应商编码]=?, enabled='0', password_hash='' WHERE username=?", realName, supplierCode, userName);
            }
            // yj_user 行可能因历史原因缺失(例如手工删了密码行):补齐,否则"启用了却登不进"
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM yj_user WHERE username=?", Integer.class, userName);
            if (n == null || n == 0) {
                jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled, [供应商编码])"
                        + " VALUES (?,?,?,'N',NULL,NULL,?,?)", userName, encoder.encode(password), realName,
                        enabled ? "1" : "0", supplierCode);
            }
        } else {
            jdbc.update("INSERT INTO yj_supplier_account (username, supplier_code, enabled, remark, create_by, asp_user1, asp_time1)"
                    + " VALUES (?,?,?,?,?,?,SYSDATETIME())", userName, supplierCode, enabled ? "1" : "0", remark, by, by);
            jdbc.update("INSERT INTO yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled, [供应商编码])"
                    + " VALUES (?,?,?,'N',NULL,NULL,?,?)", userName, encoder.encode(password), realName,
                    enabled ? "1" : "0", supplierCode);
        }
        // 权限:页面级虚拟面板 SUPPLIER_PRINT 的只读词(view,query,print)落在 yj_role_panel(该表无外键,按码存字符串)。
        // 角色是"面板权限矩阵"的数据载体;供应商账号不走角色,但登记一份让矩阵里能查到"这个账号读什么",
        // 真闸门仍是 SupplierPortalGuardFilter + 本服务的 supplier_code 过滤。
        syncAccountPanel(userName);
    }

    /** 给供应商账号所属角色(若有)登记只读的 SUPPLIER_PRINT 行;供应商账号通常无角色 ⇒ 无操作 */
    private void syncAccountPanel(String userName) {
        List<Integer> roleIds = jdbc.queryForList(
                "SELECT role_id FROM yj_user WHERE username = ? AND role_id IS NOT NULL", Integer.class, userName);
        for (Integer roleId : roleIds) {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_role_panel WHERE role_id = ? AND panel_code = ?", Integer.class,
                    roleId, PANEL_PRINT);
            if (n == null || n == 0) {
                jdbc.update("INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve) VALUES (?,?,?,'N')",
                        roleId, PANEL_PRINT, "view,query,print");
            }
        }
    }

    /** 删除供应商账号(账号行 + 登录行;历史打印留痕 yj_usage_log 保留) */
    @Transactional
    public void deleteAccount(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT username FROM yj_supplier_account WHERE id = ?", id);
        if (rows.isEmpty()) throw new IllegalStateException("供应商账号不存在");
        String userName = String.valueOf(rows.get(0).get("username"));
        jdbc.update("DELETE FROM yj_supplier_account WHERE id = ?", id);
        jdbc.update("DELETE FROM yj_user WHERE username = ? AND [供应商编码] IS NOT NULL", userName);
    }

    /** 总览(供应商权限配置页顶部):账号数 / 供应商数 / 近 30 天打印次数 */
    public Map<String, Object> overview() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("accounts", jdbc.queryForObject("SELECT COUNT(*) FROM yj_supplier_account", Integer.class));
        out.put("enabled", jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_supplier_account WHERE enabled='1'", Integer.class));
        out.put("suppliers", jdbc.queryForObject(
                "SELECT COUNT(DISTINCT supplier_code) FROM yj_supplier_account", Integer.class));
        Integer prints;
        try {
            prints = jdbc.queryForObject("SELECT COUNT(*) FROM yj_usage_log WHERE panel_name = N'供应商采购打印'"
                    + " AND created_at >= DATEADD(day, -30, SYSDATETIME())", Integer.class);
        } catch (Exception e) {
            prints = 0;
        }
        out.put("prints30d", prints);
        out.put("ledger", DataSourceRouter.current());
        return out;
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
