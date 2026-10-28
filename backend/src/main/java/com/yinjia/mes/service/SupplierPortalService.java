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
 *   <li><b>账号独立成表</b>(2026-10-25 用户口径「供应商配置的账号不属于用户账号,单独一个表吧」):
 *       账号、口令、姓名、电话、启停、归属供应商**全部在 {@code yj_supplier_account}**,
 *       与 {@code yj_user} 无任何行级关联 —— 供应商账号不会出现在组织架构/用户管理里;</li>
 *   <li>登录成功那一刻命中本表 ⇒ {@code AuthController} 把会话整体改写为:
 *       {@code supplierCode} + {@code visiblePanels=[SUPPLIER_PU_ORDER]} + 全部其它权限清单清空
 *       —— 前端菜单树因此只剩「采购管理 → 供应商门户 → 供应商采购打印」这一条;</li>
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
     * 「供应商权限配置」的权限词(与 {@link PagePanelRegistry#SUPPLIER_ACCOUNT} 动作集同一个词)。
     * 词落 yj_role_panel.perms:组织架构 →「角色与面板权限」→ 智能供应链 →「供应商权限配置」勾上即授权。
     */
    public static final String PERM_SUPPLIER_ACCOUNT = "supplier";

    /**
     * 配置供应商账号的闸门(2026-10-25 用户口径「不只是管理员可以来配置,需要能够通过组织架构
     * 添加可以配置的账号」)。
     *
     * <p>判据 = **管理员 ∪ 角色在本面板持有 {@code supplier} 词**:
     * <ul>
     *   <li>管理员恒过(与全站其他面板一致);</li>
     *   <li>组织架构里给某角色勾上「供应商权限配置 · 配置供应商账号」,该角色下的账号即可维护供应商账号
     *       (与 field/warn 同一套「逐面板授予的配置权」);</li>
     *   <li>供应商账号本身永远不过 —— 它只能看自己的采购订单,不能自己开账号;</li>
     *   <li>权限收回也立即生效(每次请求现查 yj_role_panel,无缓存)。</li>
     * </ul>
     * 前端只做入口显隐(未授权时菜单里不出现该项),这里才是真闸门。
     */
    public void requireAccountConfig() {
        String user = currentUserName();
        try {
            Integer admin = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_user WHERE username = ? AND is_admin = 'Y'", Integer.class, user);
            if (admin != null && admin > 0) return;   // 管理员恒过
        } catch (RuntimeException ignore) {
            // 账号表异常:继续走权限词判定(宁可拦下,也不放大权限)
        }
        if (supplierCodeOf(user) != null) {
            throw new AccessDeniedException("供应商账号无「供应商权限配置」权限");
        }
        boolean granted;
        try {
            granted = jdbc.queryForList(
                    "SELECT rp.perms FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                            + " WHERE u.username = ? AND rp.panel_code = ?", user, PANEL_ACCOUNT)
                    .stream().anyMatch(r -> hasWord(r.get("perms"), PERM_SUPPLIER_ACCOUNT));
        } catch (RuntimeException e) {
            granted = false;
        }
        if (!granted) {
            throw new AccessDeniedException("当前账号没有「供应商权限配置」权限(请联系管理员在组织架构里为该角色勾选「配置供应商账号」)");
        }
    }

    /** 当前账号能否配置供应商账号(前端入口显隐用;真闸门在 requireAccountConfig) */
    public boolean canConfigAccounts() {
        try {
            requireAccountConfig();
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** csv 权限词表是否含某词(与 PanelPermissionService.hasAnyPerm 同口径:逐词精确匹配) */
    private static boolean hasWord(Object perms, String word) {
        if (perms == null) return false;
        String s = String.valueOf(perms);
        for (String p : s.split(",")) {
            if (word.equals(p.trim())) return true;
        }
        return false;
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

    /**
     * 供应商档案候选(**就是单据里「关联供应商」用的那份基础资料**:账套内 `dm_gf` / 面板 GFDA)。
     *
     * <p>2026-10-25 用户口径:「不要下来框,要是可以勾选的弹窗。单据的关联供应商基础资料是一样的」
     * ⇒ 返回的列与单据参照弹窗一致:编码 / 名称 / 联系人 / 电话 / 地址,前端用**勾选弹窗**呈现。
     * 排序按编码;无关键字时最多 500 行(避免一次铺全部档案),有关键字时 100 行。
     */
    public List<Map<String, Object>> suppliers(String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        String cols = "SELECT TOP {n} ISNULL([dm],N'') AS code, ISNULL([mc],N'') AS name,"
                + " ISNULL([ywman],N'') AS contact, ISNULL([tel],N'') AS tel, ISNULL([addr],N'') AS addr";
        String from = " FROM dm_gf WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([dm],N'') <> N''";
        if (kw.isEmpty()) {
            return jdbc.queryForList(cols.replace("{n}", "500") + from + " ORDER BY [dm]");
        }
        String like = "%" + kw + "%";
        return jdbc.queryForList(cols.replace("{n}", "100") + from
                + " AND ([dm] LIKE ? OR [mc] LIKE ? OR ISNULL([ywman],N'') LIKE ? OR ISNULL([tel],N'') LIKE ?)"
                + " ORDER BY [dm]", like, like, like, like);
    }

    /**
     * 账号列表。**只读 yj_supplier_account 一张表**(2026-10-25 用户口径
     * 「供应商配置的账号不属于用户账号,单独一个表吧」—— 不再 join yj_user)。
     *
     * <p>`userEnabled` 保留同名字段给前端(状态标签看它),值直接取本表 enabled ——
     * 前端不必因为"换了个来源"而改判据。
     */
    public List<Map<String, Object>> accounts(String keyword, String supplierCode) {
        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.username AS userName, a.supplier_code AS supplierCode,"
                        + " ISNULL(g.[mc], N'') AS supplierName, a.enabled, ISNULL(a.remark,N'') AS remark,"
                        // 联系电话(2026-10-25 用户口径「可以有联系电话」):供应商侧业务联系方式,可空
                        + " ISNULL(a.phone,N'') AS phone,"
                        + " CONVERT(varchar(19),a.create_at,120) AS createAt, ISNULL(a.create_by,N'') AS createBy,"
                        // 姓名/启停全部来自本表(口令列查询接口不返回)
                        + " ISNULL(a.real_name,N'') AS realName, a.supplier_code AS userSupplierCode,"
                        + " a.enabled AS userEnabled"
                        + " FROM yj_supplier_account a"
                        + " LEFT JOIN dm_gf g ON g.[dm] = a.supplier_code WHERE 1=1");
        List<Object> args = new ArrayList<>();
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            sql.append(" AND (a.username LIKE ? OR a.supplier_code LIKE ? OR g.[mc] LIKE ?"
                    + " OR ISNULL(a.phone,N'') LIKE ? OR ISNULL(a.real_name,N'') LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like); args.add(like); args.add(like); args.add(like); args.add(like);
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
     * <p><b>2026-10-25 起只写一张表</b>(用户口径「供应商配置的账号不属于用户账号,单独一个表吧」):
     * 归属、启停、姓名、电话、**登录口令**全在 {@code yj_supplier_account},不再碰 {@code yj_user}
     * —— 供应商账号从此不会出现在组织架构/用户管理里,也不会和内部账号抢同名。
     * 停用时把口令哈希也清掉:再启用必须由采购重新设密(防解约后旧口令复用)。
     */
    @Transactional
    public void saveAccount(Map<String, Object> body) {
        String userName = str(body.get("userName"));
        String supplierCode = str(body.get("supplierCode"));
        String realName = str(body.get("realName"));
        String remark = str(body.get("remark"));
        // 联系电话(2026-10-25 用户口径「可以有联系电话」):可空,只作档案联系信息,不参与鉴权
        String phone = str(body.get("phone"));
        if (phone.length() > 50) throw new IllegalArgumentException("联系电话最多 50 个字符");
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
            // 与内部账号**重名**仍要拦:两者是两套凭据,但登录入口只有一个登录框,
            // 同名会让"到底登进了哪一边"无法解释 ⇒ 新建时明确拒绝,不制造歧义。
            Integer dup = jdbc.queryForObject("SELECT COUNT(*) FROM yj_user WHERE username = ?", Integer.class, userName);
            if (dup != null && dup > 0) throw new IllegalStateException("该账号名已被内部账号占用:" + userName);
            if (password.isBlank()) throw new IllegalArgumentException("新建供应商账号必须设置密码");
        }
        if (!password.isBlank() && password.length() < 6) throw new IllegalArgumentException("密码至少 6 位");
        // 姓名留空 ⇒ 取供应商档案名称(用户口径「姓名不用」指"不因勾选供应商自动改",不是"不许有姓名")
        if (realName.isEmpty()) realName = supplierName(supplierCode);

        String by = currentUserName();
        if (editing) {
            int id = Integer.parseInt(String.valueOf(idObj));
            if (!password.isBlank()) {
                jdbc.update("UPDATE yj_supplier_account SET supplier_code=?, enabled=?, remark=?, phone=?, real_name=?,"
                                + " password_hash=?, update_by=?, update_at=SYSDATETIME() WHERE id=?",
                        supplierCode, enabled ? "1" : "0", remark, phone.isEmpty() ? null : phone, realName,
                        encoder.encode(password), by, id);
            } else if (enabled) {
                // 启用且没改密码:口令保持原值(可能就是之前停用时被清空 ⇒ 下面兜底提示)
                jdbc.update("UPDATE yj_supplier_account SET supplier_code=?, enabled='1', remark=?, phone=?, real_name=?,"
                                + " update_by=?, update_at=SYSDATETIME() WHERE id=?",
                        supplierCode, remark, phone.isEmpty() ? null : phone, realName, by, id);
                requirePassword(userName);
            } else {
                // 停用 + 清空口令:重新启用必须重设密码(见方法头注)
                jdbc.update("UPDATE yj_supplier_account SET supplier_code=?, enabled='0', remark=?, phone=?, real_name=?,"
                                + " password_hash=NULL, update_by=?, update_at=SYSDATETIME() WHERE id=?",
                        supplierCode, remark, phone.isEmpty() ? null : phone, realName, by, id);
            }
        } else {
            jdbc.update("INSERT INTO yj_supplier_account (username, supplier_code, enabled, remark, phone, real_name,"
                            + " password_hash, create_by, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,SYSDATETIME())",
                    userName, supplierCode, enabled ? "1" : "0", remark, phone.isEmpty() ? null : phone, realName,
                    encoder.encode(password), by, by);
        }
        // 权限:只读词(view,query,print)登记到 yj_role_panel —— 供应商账号无角色时是空操作,
        // 真闸门仍是 SupplierPortalGuardFilter + QueryService 的 supplier_code 强制过滤。
        syncAccountPanel(userName);
    }

    /** 启用中的供应商账号必须有口令,否则"启用了却登不进"—— 报错说清补救办法 */
    private void requirePassword(String userName) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_supplier_account WHERE username = ? AND password_hash IS NOT NULL AND password_hash <> N''",
                Integer.class, userName);
        if (n == null || n == 0) {
            throw new IllegalStateException("该账号当前没有密码(停用时已清空),请在同一窗口直接设置新密码后再启用");
        }
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

    /**
     * 删除供应商账号。**只删本表**(2026-10-25 起供应商账号独立成表,不再有 yj_user 行);
     * 历史打印留痕(yj_usage_log)保留,便于对账。
     */
    @Transactional
    public void deleteAccount(int id) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT username FROM yj_supplier_account WHERE id = ?", id);
        if (rows.isEmpty()) throw new IllegalStateException("供应商账号不存在");
        String userName = String.valueOf(rows.get(0).get("username"));
        jdbc.update("DELETE FROM yj_supplier_account WHERE id = ?", id);
        // 兜底清理:历史遗留的镜像行(旧实现写过 yj_user),有才删、没有也不算错
        try {
            jdbc.update("DELETE FROM yj_user WHERE username = ? AND ISNULL(is_admin,'N') <> 'Y'"
                    + " AND NOT EXISTS (SELECT 1 FROM yj_supplier_account a WHERE a.username = yj_user.username)", userName);
        } catch (RuntimeException ignore) {
            // yj_user 结构差异不应挡住删除本身
        }
    }

    // ==================== 供应商账号登录(单表凭据) ====================

    /**
     * 按供应商账号表校验口令并返回登录所需信息(2026-10-25 用户口径
     * 「供应商配置的账号不属于用户账号,单独一个表吧」)。
     *
     * @return 命中并校验通过 → 该账号行;账号不存在 → {@code null};口令错/已停用 → 抛异常
     *
     * <p>⚠ 调用方(AuthController.login)先查 yj_user,查不到才走这里 —— 内部账号优先,
     * 供应商账号不会与内部账号同名(新建时已拦),所以不会出现"两边都能登"的歧义。
     */
    public Map<String, Object> authenticate(String username, String rawPassword) {
        if (username == null || username.isBlank()) return null;
        List<Map<String, Object>> rows;
        try {
            rows = jdbc.queryForList(
                    "SELECT id, username, supplier_code, enabled, ISNULL(real_name,N'') AS real_name,"
                            + " ISNULL(password_hash,N'') AS password_hash"
                            + " FROM yj_supplier_account WHERE username = ?", username);
        } catch (RuntimeException e) {
            // 表还没建(未执行迁移):当作"不是供应商账号",让内部账号流程继续报"用户名或密码错误"
            return null;
        }
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        if (!"1".equals(String.valueOf(row.get("enabled")))) {
            throw new IllegalStateException("该供应商账号已停用,请联系采购部");
        }
        String hash = String.valueOf(row.get("password_hash"));
        if (hash.isBlank() || !encoder.matches(rawPassword, hash)) {
            throw new IllegalStateException("用户名或密码错误");
        }
        return row;
    }

    /** 供应商账号自助改密(口令就存在本表;停用账号不许改) */
    @Transactional
    public void changePassword(String username, String oldPassword, String newPassword) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT enabled, ISNULL(password_hash,N'') AS password_hash FROM yj_supplier_account WHERE username = ?",
                username);
        if (rows.isEmpty()) throw new IllegalStateException("供应商账号不存在");
        Map<String, Object> row = rows.get(0);
        if (!"1".equals(String.valueOf(row.get("enabled")))) {
            throw new IllegalStateException("账号已停用,不能修改密码");
        }
        String hash = String.valueOf(row.get("password_hash"));
        if (hash.isBlank() || !encoder.matches(oldPassword, hash)) {
            throw new IllegalStateException("原密码不正确");
        }
        jdbc.update("UPDATE yj_supplier_account SET password_hash = ?, update_by = ?, update_at = SYSDATETIME()"
                + " WHERE username = ?", encoder.encode(newPassword), username, username);
    }

    /** 该用户名是否属于供应商账号表(登录/回取会话时判分支用;表不可用时返回 false) */
    public boolean isSupplierAccount(String username) {
        if (username == null || username.isBlank()) return false;
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM yj_supplier_account WHERE username = ?", Integer.class, username);
            return n != null && n > 0;
        } catch (RuntimeException e) {
            return false;
        }
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
