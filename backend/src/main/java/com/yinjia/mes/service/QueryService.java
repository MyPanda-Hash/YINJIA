package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 查询服务:把 HSDZ_MES 真实表数据映射为 light-mes 行契约。
 * 行契约:{..表头字段(中文标签), 编号, 单据状态, 审核人, 审核时间, detail:{items:[...]}}
 * - doc 模式:按 yj_panel.group_col 分组,一张单一行,明细挂在 detail.items
 *   * 单表式(inh/outh/Porder/mate):头字段取首行(旧行表本身携带头信息)
 *   * 头行式(order_bt+order_bs):头查头表,行查行表
 * - archive 模式:整份档案合成一张"单单据",记录行在 detail.items
 */
@Service
public class QueryService {

    /**
     * 两级审批面板(2026-10-04):纸面「审核」= 一级审批通过的人、「批准」= 超级管理员,
     * 两个值分别写进表内的 审核人 / 审批人 列 —— 与 ButtonService 同一份口径
     * (直接引用 {@code ButtonService.ADMIN_L2_PANELS}:二级固定超级管理员的那一族 = 全部质量单据)。
     * 见 {@link #loadDocs} 里对虚拟字段「审核人」覆盖的例外。
     */
    private static boolean isTwoLevelSignPanel(String panelCode) {
        return panelCode != null && ButtonService.ADMIN_L2_PANELS.contains(panelCode);
    }

    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;
    private final TranslationService translations;

    public QueryService(PanelRegistry registry, JdbcTemplate jdbc, TranslationService translations) {
        this.registry = registry;
        this.jdbc = jdbc;
        this.translations = translations;
    }

    /**
     * 自带左栏「分仓库」列表的面板 —— **只有它**认 {@code condition._whCodes}。
     *
     * <p>闸门理由(2026-10-15):库存状况表/台账/收发式汇总都有「仓库编码」列,一旦收到残留的
     * {@code _whCodes}(前端切面板没清干净、或别的客户端乱传),就会被静默过滤成 0 行 ——
     * 用户报的「库存明细的查询会影响到库存状况表」正是这类跨面板串味。前端同时改成"请求时派生",
     * 这里是服务端的第二道防线。
     */
    private static final List<String> WH_DOCK_PANELS = List.of("STOCK_DETAIL");
    /**
     * 供应商门户的数据范围控制键(2026-10-25 用户口径「供应商打印面版的前端要与采购订单一致。
     * 只是显示和权限不一样」)。
     *
     * <p>供应商端**直接复用采购订单面板**(同一个 PanelxList、同一套版式与打印),它把登录态里绑定的
     * 供应商编码放进 {@code condition["__supplierScope"]};本类在**服务端**把它翻译成
     * {@code [供应商编码] LIKE 值} 并 AND 进 WHERE —— 与「查询」弹窗里选供应商完全同一口径
     * (供应商编码在本系统按**名称**存,金蝶口径,故用 LIKE 与 appendDocFilters 的字段条件一致)。
     *
     * <ul>
     *   <li>键以双下划线开头 = 控制键,不是字段标签 ⇒ 通用字段循环(appendDocFilters)不会误吃;这里显式剔除;</li>
     *   <li>**只在单据模式生效**;面板里没有「供应商编码」列 ⇒ 直接 403(宁可报错,也不当成"没有过滤"放全量);</li>
     *   <li>值来自登录态由前端带上来,但真正的隔离还有两层:SupplierPortalGuardFilter(供应商会话除门户接口
     *       外一律 403)+ 门户接口自身按服务端认定的 supplier_code 过滤。这里这一层是在"允许的
     *       /px/queryFormDataList"上再加一道数据范围,防止把整表拉走。</li>
     * </ul>
     */
    public static final String SUPPLIER_SCOPE_KEY = "__supplierScope";

    /**
     * 供应商会话可用的**唯一**面板接口(2026-10-25 用户口径「供应商打印面版的前端要与采购订单一致。
     * 只是显示和权限不一样」)。
     *
     * <p>供应商端直接渲染采购订单面板(PanelxList),它必须能取数;而供应商会话在
     * {@code SupplierPortalGuardFilter} 里被默认拒绝(其余 /api 一律 403)。所以这里把
     * 「查询列表」这一条**定向放行**,代价是:范围过滤必须在服务端完成,不能依赖前端。
     * 故 {@link #queryFormDataList} 在**供应商会话**下会**忽略**前端传来的条件,强制
     * {@code 供应商编码 = 登录账号绑定的供应商}(见 {@link #enforceSupplierScope})。
     *
     * <p>只放行这一条:getPanelConfig(元数据)、getFormDescriptor(单据详情)、callButton(动作)、
     * deleteForms 等一律仍被过滤器挡住 —— 供应商拿不到编辑态需要的接口,写不了也看不到别人的单。
     */
    public static final String PANEL_LIST_PATH = "/api/px/queryFormDataList";

    /**
     * 供应商会话可用的**面板元数据**接口(2026-10-25 同上口径)。
     *
     * <p>采购订单面板的**工具栏按钮组**(「打印」组里是 打印采购订单/预览/导出/打印材料码)、
     * 明细页签、表头字段都来自这一条配置接口 —— 不放行,供应商端就只剩一颗「查询」,
     * 与采购订单长得不一样(而这正是用户要的一致)。它是**只读元数据**,不含业务数据;
     * 业务数据的范围过滤仍由 {@link #enforceSupplierScope} 在列表接口上强制。
     */
    public static final String PANEL_CONFIG_PATH = "/api/px/getPanelConfig";

    /**
     * 供应商会话可用的**单张单据详情**接口(2026-10-25 用户口径「只有打印按钮和查询」)。
     *
     * <p>纸质单打印(print-formats)与明细预览都走这一条取「头 + 明细行」。不放行 ⇒ 点「打印」
     * 拿不到数据(实测:下拉里有 打印采购订单,点了没纸)。它是**只读**取数,但会返回完整单据内容,
     * 所以必须在服务端限定范围:{@link #loadOneDoc} 不走列表过滤,故由
     * {@link #supplierMayReadDoc} 逐单核对「这张单的供应商编码 = 当前会话的供应商编码」,不符即 403。
     */
    public static final String FORM_DESCRIPTOR_PATH = "/api/px/getFormDescriptor";

    /** 供应商会话读取单张单据前的归属核对(见 {@link #FORM_DESCRIPTOR_PATH}) */
    public boolean supplierMayReadDoc(String panelCode, String docNo) {
        String code = sessionSupplierCode();
        if (code == null) return true;                 // 内部账号:不限制
        if (code.isEmpty()) return false;              // 供应商账号已停用
        if (!SUPPLIER_PANEL_CODE.equals(panelCode)) return false;
        if (docNo == null || docNo.isBlank()) return false;
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM bd_pu_order WHERE [单据编号] = ? AND ISNULL([供应商编码],N'') = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, docNo.trim(), code);
            return n != null && n > 0;
        } catch (RuntimeException e) {
            return false;                              // 查不到就拒绝(默认拒绝)
        }
    }

    /**
     * 当前登录人若是供应商会话,返回其绑定供应商编码(否则 null)。
     * 抽成静态方法是为了让过滤器与 QueryService 用**同一个判据**(都在 yj_supplier_account 上),
     * 不在 QueryService 里再注入一份 SupplierPortalService 造成循环依赖风险。
     *
     * <p>返回值三态:
     * <ul>
     *   <li>{@code null} = 不是供应商账号(内部账号);</li>
     *   <li>{@code ""} = 是供应商账号但**已停用**;</li>
     *   <li>其它 = 该账号绑定的供应商编码。</li>
     * </ul>
     * 2026-10-29 改为 public:材料码打印的权限闸门(PxController.requireMaterialLabelAccess)也要用它区分
     * 「内部账号按面板权 / 供应商账号按逐单归属」。
     */
    public String sessionSupplierCode() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String user = auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : null;
        if (user == null) return null;
        try {
            java.util.List<java.util.Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT supplier_code, enabled FROM yj_supplier_account WHERE username = ?", user);
            if (rows.isEmpty()) return null;
            if (!"1".equals(String.valueOf(rows.get(0).get("enabled")))) return "";
            Object code = rows.get(0).get("supplier_code");
            return code == null ? null : String.valueOf(code).trim();
        } catch (RuntimeException e) {
            return null;   // 表未建/库抖动:按"不是供应商"处理(与 SupplierPortalService 同口径)
        }
    }

    /**
     * 供应商会话的范围收口(服务端权威,不信前端):
     * ① 只允许 PU_ORDER 面板(供应商端就是采购订单页;别的面板一律拒绝);
     * ② 条件里的「供应商编码」**无条件覆盖**成登录态认定的编码 —— 前端不传、传错、传空都无效;
     * ③ 前提是该面板确实有「供应商编码」字段,否则等价于"没有范围"⇒ 直接拒绝(宁可报错也不漏数据)。
     */
    private Map<String, Object> enforceSupplierScope(String panelCode, Map<String, Object> condition, String code) {
        if (!SUPPLIER_PANEL_CODE.equals(panelCode)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "供应商账号只能查询「供应商采购打印」面板:" + panelCode);
        }
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        if (def.byLabel("供应商编码") == null) {
            throw new org.springframework.security.access.AccessDeniedException("采购订单面板缺少「供应商编码」字段,无法限定范围");
        }
        Map<String, Object> merged = condition == null ? new LinkedHashMap<>() : new LinkedHashMap<>(condition);
        merged.remove(SUPPLIER_SCOPE_KEY);
        merged.put("供应商编码", code);   // 覆盖式写入:前端任何同名条件都被丢弃
        return merged;
    }

    /**
     * 供应商端唯一允许的面板(2026-10-25 用户口径「是多做一个和采购订单一样的供应商面版,
     * 只有打印按钮和查询(查询必须只能查供应商关联的数据)按钮的」)。
     *
     * <p>它是 PU_ORDER 的**元数据副本**(同一张 bd_pu_order/bl_pu_order,字段逐列复制,
     * 见 tools/migrate-supplier-po-panel-20261025.sql),工具栏只有「查询 + 打印」。
     * 供应商会话**只能**查这一张;查别的一律拒绝(见 {@link #enforceSupplierScope})。
     */
    public static final String SUPPLIER_PANEL_CODE = "SUPPLIER_PU_ORDER";

    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize) {
        return queryFormDataList(panelCode, keyword, condition, pageNo, pageSize, null);
    }

    /**
     * @param advFilters 查询弹窗「高级筛选」条件行 [{field=字段标签, op, value}];仅平表模式(报表)生效,
     *                   逐条 AND 并入 WHERE —— 全表过滤,分页 totalSize 与导出口径一致。
     *                   单据/档案模式忽略该参数(它们本来就在 Java 侧按行过滤)。
     */
    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize,
                                                 List<Map<String, Object>> advFilters) {
        return queryFormDataList(panelCode, keyword, condition, pageNo, pageSize, advFilters, false);
    }

    /**
     * @param countOnly 只要「共 N 条」不要行。前端「参照字段行数」判定(≤20 弹窗 / &gt;20 下拉,
     *                  {@code engine.refRowCount})只需要 totalSize,却会走完整取数 —— 对
     *                  **档案模式**(如商品档案 INV:3,874 行 × 75 列 = 4.1 MB,且档案模式按契约
     *                  忽略 pageSize 全量返回)这一条就把 4 MB 白拉一遍。库存报表三张
     *                  (库存状况表/库存台账/收发存汇总表)的「存货」参照全指 INV ⇒ 每次打开
     *                  都白拉一次,并行负载下实测 28~36 s &gt; 前端 axios 15 s 线(2026-10-15)。
     *                  置 true 时:照常算 totalSize,直接返回空 list,不执行取数 SQL。
     */
    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize,
                                                 List<Map<String, Object>> advFilters, boolean countOnly) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        // 供应商会话的范围收口(2026-10-25):优先级最高 —— 登录态认定的供应商编码**覆盖**前端一切条件,
        // 见 {@link #enforceSupplierScope}。这样即便把本条接口放行给供应商,也拉不到别人的单。
        String sessionSupplier = sessionSupplierCode();
        if (sessionSupplier != null) {
            if (sessionSupplier.isEmpty()) {
                throw new org.springframework.security.access.AccessDeniedException("供应商账号已停用,请联系采购部");
            }
            condition = enforceSupplierScope(panelCode, condition, sessionSupplier);
        }
        // 供应商范围控制键(2026-10-25):先摘出来,再按需折成「供应商编码 LIKE 值」——
        // 见 {@link #SUPPLIER_SCOPE_KEY} 的长注释。放最前是因为后面三种模式都要用它。
        String supplierScope = "";
        if (condition != null && condition.get(SUPPLIER_SCOPE_KEY) != null) {
            supplierScope = String.valueOf(condition.get(SUPPLIER_SCOPE_KEY)).trim();
            if (!supplierScope.isEmpty()) {
                condition = new LinkedHashMap<>(condition);
                condition.remove(SUPPLIER_SCOPE_KEY);
                condition.put("供应商编码", supplierScope);   // 与弹窗选供应商同一口径(按名称 LIKE)
            } else {
                condition = new LinkedHashMap<>(condition);
                condition.remove(SUPPLIER_SCOPE_KEY);
            }
        }
        Map<String, String> l2c = def.labelToCol();
        if ("flat".equals(def.mode())) {
            return queryFlat(def, keyword, condition, l2c, pageNo, pageSize, advFilters, countOnly);
        }
        return def.isDoc() ? queryDocs(def, keyword, condition, l2c, pageNo, pageSize, advFilters, countOnly)
                : queryArchive(def, keyword, condition, l2c, pageNo, pageSize, countOnly);
    }

    // ============ 平表模式(报表/库存状况,一行一记录直接返回) ============

    private Map<String, Object> queryFlat(PanelRegistry.PanelDef def, String keyword,
                                          Map<String, Object> condition, Map<String, String> l2c,
                                          int pageNo, int pageSize, List<Map<String, Object>> advFilters,
                                          boolean countOnly) {
        boolean ledger = "STOCK_LEDGER".equals(def.code()); // 台账:正序 + 首期初行/末期末行(T+ 三段式)
        // 服务端每页条数上限(2026-10-15):库存报表三张是「整表重算型」视图,单页行数直接决定
        // 响应体与前端渲染量;面板配置(page_size=50)就是期望值,任何客户端要更多都夹回该值。
        pageSize = Math.min(Math.max(pageSize, 1), flatPageCap(def));
        String hint = recompileOnRead(def.lineTable()) ? " OPTION (RECOMPILE)" : "";
        String cols = selectCols(def, def.fields(), null);
        StringBuilder where = new StringBuilder("WHERE ").append(cancelFilter(def.lineTable()));
        List<Object> args = new ArrayList<>();
        // 台账/库存状况(级联面板)的 仓库/存货 条件:一律交给 appendDirectFilters 的「编码优先、退化名称」
        // 口径(见其长注释)。**这里不再把名称位当编码比** —— 2026-10-20 事故就是这里写死了
        // `RTRIM(t.[仓库编码]) = 仓库值`,而弹窗里放的是名称 ⇒ 台账查询恒 0 行明细(只剩期初/期末两行)。
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");
        appendAdvFilters(advFilters, where, args, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + def.lineTable() + " t " + where + hint, Integer.class, args.toArray());

        // 台账三段式:首行=期初结存(仅期初组有值),末行=期末结存(仅期末组有值)。
        // 期初=查询段起点前的累计;期末=期初+段内净额。依赖弹窗必填的 仓库/存货/日期段。
        // 两行合成行也算进 totalSize(分页页码才对得上),故在 countOnly 分支之前先判。
        int totalOut = total == null ? 0 : total;
        boolean ledgerSynthetic = ledger && condition != null
                && !strOf(condition.get("仓库")).isBlank() && !strOf(condition.get("存货")).isBlank()
                && !strOf(condition.get("开始日期")).isBlank() && !strOf(condition.get("结束日期")).isBlank();
        if (ledgerSynthetic) totalOut += 2;

        // 只要「共 N 条」:到此为止(argv 见方法注释),不再执行取数 SQL
        if (countOnly) {
            Map<String, Object> counted = new HashMap<>();
            counted.put("totalSize", totalOut);
            counted.put("list", List.of());
            return counted;
        }

        // 列表默认排序(2026-10-14 用户口径「应该最新的单据日期在最上面」):
        //   有日期列且该列确实存在 ⇒ 「日期 DESC, id DESC」(同一天按录入先后倒排);
        //   否则退回 id DESC(原行为);台账(ledger)保持 id ASC。
        // ⚠ 必须确认列真实存在:面板的 date_col 未必落在列表用的这张表上(单据面板的日期在头表),
        //   盲写会直接 SQL 报「列名无效」把列表打挂 ⇒ 先查 sys.columns。
        String orderBy = "t.id " + (ledger ? "ASC" : "DESC");
        if (!ledger && def.dateCol() != null && !def.dateCol().isBlank()) {
            Integer has = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?",
                    Integer.class, "dbo." + def.lineTable(), def.dateCol());
            if (has != null && has > 0) orderBy = "t.[" + def.dateCol() + "] DESC, t.id DESC";
        }

        String sql = "SELECT t.id AS __id, " + cols + " FROM " + def.lineTable() + " t " + where
                + " ORDER BY " + orderBy + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY" + hint;
        args.add((pageNo - 1) * pageSize);
        args.add(pageSize);
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = rowToLabels(def, r, true);
            if (ledger) { // 明细行不重复显示期初列(期初只在首行汇总呈现,T+ 同款)
                m.put("期初数量", null); m.put("期初平均单价", null); m.put("期初金额", null);
            }
            list.add(m);
        }

        // 台账三段式合成行(见上方 ledgerSynthetic 判定):期初=查询段起点前的累计,期末=期初+段内净额。
        // 依赖弹窗必填的 仓库/存货/日期段。
        if (ledgerSynthetic) {
            // 仓库/存货的匹配值:与明细同一口径(有编码用编码,没编码才用名称;名称位放的是编码也认)。
            // 2026-10-20 前这里写死 `RTRIM(仓库编码)=condition['仓库']`,而弹窗里放名称 ⇒
            // 期初/期末也按"名称=编码"算成 0(于是用户看到「只有两行且数都是 0」)。
            String whV = ledgerKey(condition, "仓库");
            String itemV = ledgerKey(condition, "存货");
            boolean byCodeWh = ledgerKeyIsCode(def, condition, "仓库");
            boolean byCodeItem = ledgerKeyIsCode(def, condition, "存货");
            String whCond = byCodeWh ? "RTRIM(仓库编码)=?" : "RTRIM(仓库)=?";
            String itemCond = byCodeItem ? "RTRIM(存货编码)=?" : "RTRIM(存货)=?";
            String ds = strOf(condition.get("开始日期"));
            String de = strOf(condition.get("结束日期"));
            // 期初 = 段起点前累计(视图中限 单据日期<=de 的行,取 <ds 部分;用视图暴露的收入/发出列)
            Map<String, Object> opening = jdbc.queryForMap(
                    "SELECT ISNULL(SUM(CASE WHEN 单据日期 < ? THEN 收入数量 - 发出数量 ELSE 0 END),0) AS q,"
                            + " ISNULL(SUM(CASE WHEN 单据日期 < ? THEN 收入金额 - 发出金额 ELSE 0 END),0) AS a"
                            + " FROM v_stock_ledger WHERE " + whCond + " AND " + itemCond + " AND 单据日期 <= ?" + hint,
                    ds, ds, whV, itemV, de);
            double oq = numD(opening.get("q")), oa = numD(opening.get("a"));
            Map<String, Object> netm = jdbc.queryForMap(
                    "SELECT ISNULL(SUM(收入数量 - 发出数量),0) AS q, ISNULL(SUM(收入金额 - 发出金额),0) AS a"
                            + " FROM v_stock_ledger WHERE " + whCond + " AND " + itemCond
                            + " AND 单据日期 >= ? AND 单据日期 <= ?" + hint,
                    whV, itemV, ds, de);
            double cq = oq + numD(netm.get("q")), ca = oa + numD(netm.get("a"));
            int lastPage = (int) Math.ceil(totalOut / (double) pageSize);
            if (pageNo == 1) list.add(0, ledgerRow("期初结存", oq, oa, null, null));
            if (pageNo == lastPage) list.add(ledgerRow("期末结存", null, null, cq, ca));
        }

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", totalOut);
        out.put("list", list);
        return out;
    }

    /** 台账合成行用的匹配值(编码优先;没编码才用名称位) */
    private String ledgerKey(Map<String, Object> condition, String dim) {
        String code = strOf(condition.get("仓库".equals(dim) ? "_whCode" : "_itemCode"));
        if (!code.isEmpty()) return code;
        return strOf(condition.get(dim));
    }

    /** 台账合成行的匹配值是不是编码(决定 WHERE 里比编码列还是名称列) */
    private boolean ledgerKeyIsCode(PanelRegistry.PanelDef def, Map<String, Object> condition, String dim) {
        String code = strOf(condition.get("仓库".equals(dim) ? "_whCode" : "_itemCode"));
        if (!code.isEmpty()) return true;
        String name = strOf(condition.get(dim));
        if (name.isEmpty()) return true;
        String col = def.labelToCol().get(dim);
        String codeCol = "仓库".equals(dim) ? "仓库编码" : "存货编码";
        return col == null || looksLikeCodeOf(col, name, "v_stock_ledger", codeCol).test();
    }

    /**
     * 取数是否要带 OPTION (RECOMPILE) —— 库存报表 4 张「报表式平表」专属(2026-09-22)。
     *
     * <p>为什么必须加:这 4 张表的取数参与表全是**无索引堆表**(已由
     * tools/migrate-stock-report-perf.sql 补索引与统计信息),兼容级别 100 下基数估算
     * 极易退化;坏计划一旦进计划缓存就**永不重优化**。实测同一条 SQL、同一份数据:
     * 缓存计划 65,021 ms vs OPTION (RECOMPILE) 42 ms,差 600 倍 —— 前端 axios 15 s 超时
     * 就是这么来的。视图**不能带 hint**,故只能在取数 SQL 上补。
     *
     * <p>代价可忽略:这几张报表最大 247 行,单次编译约 ms 级;调用方对 4 张表之外的
     * 面板不产生任何影响(单据/档案模式走 queryDocs/queryArchive,与此无关)。
     */
    private static boolean recompileOnRead(String lineTable) {
        switch (lineTable == null ? "" : lineTable) {
            case "v_stock_balance":  // STOCK_BALANCE 库存状况表
            case "v_stock_ledger":   // STOCK_LEDGER  库存台账
            case "v_stock_summary":  // STOCK_SUMMARY 收发存汇总表
            case "kucun":            // STOCK_STATUS  库存状况
                return true;
            default:
                return false;
        }
    }

    /**
     * 平表(报表)每页条数上限(2026-10-15)。
     *
     * <p>库存报表三张(库存状况表/库存台账/收发存汇总表)的取数是「整表重算型」视图:
     * {@code v_stock_balance} 等视图的 {@code id} 是 {@code ROW_NUMBER() OVER(...)},
     * 计数与分页两条 SQL 都要把整份视图物化一遍 ⇒ **单页要多少行,直接决定这次请求的
     * 计算量与响应体大小**。面板在 {@code yj_panel.page_size} 里已经声明期望值(50),
     * 这里把它变成服务端硬上限:任何客户端(旧版前端、桌面小部件、手工调接口)要更多都夹回来,
     * 保证「一页 50 条」这条口径不依赖调用方自觉。
     *
     * <p>范围刻意收窄到这三张报表面板:它们唯一的调用方(列表页)本来就用
     * {@code yj_panel.page_size}=50,夹取不改变任何现有行为;其它平表(明细表/统计表/
     * STOCK_STATUS 桌面小部件等)一律不受影响(给一个 1000 行的纯防呆上限)。
     */
    private static int flatPageCap(PanelRegistry.PanelDef def) {
        String code = def.code() == null ? "" : def.code();
        switch (code) {
            case "STOCK_BALANCE":
            case "STOCK_LEDGER":
            case "STOCK_SUMMARY":
                Integer configured = def.pageSize();
                return configured != null && configured > 0 ? configured : 50;
            default:
                return 1000;
        }
    }

    /** 台账合成行:期初行只填期初组,期末行只填期末组;单价=金额/数量(数量0→0) */    private Map<String, Object> ledgerRow(String type, Double oq, Double oa, Double cq, Double ca) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据类型", type);
        if (oq != null) {
            m.put("期初数量", oq);
            m.put("期初平均单价", oq != 0 && oa != null ? oa / oq : 0);
            m.put("期初金额", oa);
        }
        if (cq != null) {
            m.put("期末数量", cq);
            m.put("期末平均单价", cq != 0 && ca != null ? ca / cq : 0);
            m.put("期末金额", ca);
        }
        return m;
    }

    private double numD(Object v) { return v == null ? 0 : ((Number) v).doubleValue(); }
    private String strOf(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    // ============ 档案模式(单单据) ============
    // 档案保存语义 = 全量明细 upsert(缺席行=已删除),因此查询必须返回全量行,
    // 否则截断会造成"未加载的行被误删"。上限内全量返回;超出上限时 ButtonService.saveArchive
    // 的同值护栏会拒绝保存(2026-09-16:商品 bs_inv 已 3850 行,旧上限 2000 已被击穿)。

    /** 档案全量加载/保存护栏共用上限(行) */
    public static final int ARCH_LOAD_CAP = 50_000;

    private Map<String, Object> queryArchive(PanelRegistry.PanelDef def, String keyword,
                                             Map<String, Object> condition, Map<String, String> l2c,
                                             int pageNo, int pageSize, boolean countOnly) {
        // 派生列「面板名称」(2026-10-18,仅数据建模·字段管理):yj_field 里没有这一列,
        // 名称是 panel_code 的关联显示名 ⇒ 按 codeCol 关联 yj_panel 带出(判定见 PanelConfigService.derivedPanelName)
        String panelNameField = derivedPanelNameLabel(def);
        String cols = selectCols(def, def.fields(), panelNameField);
        String from = def.lineTable() + " t";
        if (panelNameField != null) {
            from += " LEFT JOIN yj_panel pn ON pn.panel_code = t.[" + def.codeCol() + "]";
        }
        StringBuilder where = new StringBuilder("WHERE ").append(cancelFilter(def.lineTable()));
        List<Object> args = new ArrayList<>();
        appendDirectFilters(def, def.lineTable(), where, args, keyword, condition, l2c, "t");

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + from + " " + where, Integer.class, args.toArray());

        // 只要「共 N 条」:档案模式本就全量返回(见方法上方注释),对参照取数(如商品档案 INV
        // 3,874 行 × 75 列 = 4.1 MB)白拉一遍是最贵的一处,countOnly 时到此为止。
        if (countOnly) {
            Map<String, Object> counted = new HashMap<>();
            counted.put("totalSize", total == null ? 0 : total);
            counted.put("list", List.of());
            return counted;
        }

        // 全量返回(上限 ARCH_LOAD_CAP):保存语义为"缺席行=已删除",必须保证明细完整
        String sql = "SELECT t.id AS __id, " + cols
                + (panelNameField != null ? ", pn.panel_name AS [" + panelNameField + "]" : "")
                + " FROM " + from + " " + where
                + " ORDER BY t.id DESC OFFSET 0 ROWS FETCH NEXT " + ARCH_LOAD_CAP + " ROWS ONLY";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args.toArray());

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> r : rows) items.add(rowToLabels(def, r, true));

        // 单单据契约:一张虚拟单承载整份档案,记录在 detail.<tabKey>(light-mes §八)
        Map<String, Object> doc = new LinkedHashMap<>();
        // 档案虚拟单据的"编号"=面板名:按请求 locale 下发译名(显示层,数据层仍中文面板名)
        String localeKey = TranslationService.localeKey(org.springframework.context.i18n.LocaleContextHolder.getLocale());
        String docName = "zh".equals(localeKey) ? def.name()
                : translations.scope(localeKey, "panel").getOrDefault(def.name(), def.name());
        doc.put("编号", docName);
        doc.put("状态", "启用");
        doc.put("单据状态", "启用");
        doc.put("detail", Map.of(def.tabKey(), items));

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", total == null ? 0 : total);
        out.put("list", List.of(doc));
        return out;
    }

    // ============ 单据模式 ============

    private Map<String, Object> queryDocs(PanelRegistry.PanelDef def, String keyword,
                                          Map<String, Object> condition, Map<String, String> l2c,
                                          int pageNo, int pageSize, List<Map<String, Object>> advFilters,
                                          boolean countOnly) {
        boolean split = def.hasHeadTable();
        String docTable = split ? def.headTable() : def.lineTable();
        String g = def.groupCol();
        List<PanelRegistry.FieldDef> docCols = split ? def.fieldsAt("header") : def.fields();

        StringBuilder where = new StringBuilder("WHERE ").append(cancelFilter(def.lineTable()));
        List<Object> args = new ArrayList<>();
        // 高级筛选(2026-09-24 用户要求,对齐旧系统 列表查询):单据面板同样服务端逐条 AND 过滤——
        // 全表过滤(分页 totalSize 与导出一致),不再只做前端当前页过滤。
        // 头行单据只认头表字段:行级字段(物料编码/产品名称…)在头表不存在的会被剔除,避免无效列报错。
        appendAdvFiltersForDocs(def, advFilters, where, args, l2c, split);
        // 文件面板「查询单据」自定义条件:_docNo=编号模糊(单据编号/文档编号),_archFrom/_archTo=首次归档时间区间(含端点)
        Object qDocNo = condition == null ? null : condition.get("_docNo");
        Object qFrom = condition == null ? null : condition.get("_archFrom");
        Object qTo = condition == null ? null : condition.get("_archTo");
        Map<String, Object> fieldCond = condition;
        if (qDocNo != null || qFrom != null || qTo != null) {
            fieldCond = new HashMap<>(condition);
            fieldCond.remove("_docNo");
            fieldCond.remove("_archFrom");
            fieldCond.remove("_archTo");
        }
        appendDocFilters(def, where, args, keyword, fieldCond, l2c, split, docCols, docTable, g);
        String noKw = qDocNo == null ? "" : String.valueOf(qDocNo).trim();
        if (!noKw.isEmpty()) {
            where.append(" AND (t.[").append(g).append("] LIKE ?");
            args.add("%" + noKw + "%");
            boolean hasDocNoCol = split && docCols.stream().anyMatch(f -> "文档编号".equals(f.label()));
            if (hasDocNoCol) {
                where.append(" OR t.[文档编号] LIKE ?");
                args.add("%" + noKw + "%");
            }
            where.append(")");
        }
        String archFrom = qFrom == null ? "" : String.valueOf(qFrom).trim();
        String archTo = qTo == null ? "" : String.valueOf(qTo).trim();
        // 单据状态记账面板(2026-10-25):副本面板(如供应商采购打印)的状态行记在源面板名下,
        // 不折算就会查不到自己的作废/删除/归档痕迹 —— 已删除的单据还会照旧出现。详见 PanelAliases。
        String statusPanel = com.yinjia.mes.panel.PanelAliases.statusSource(def.code());
        if (!archFrom.isEmpty() || !archTo.isEmpty()) {
            where.append(" AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = t.[")
                    .append(g).append("] AND s.archived_at IS NOT NULL");
            args.add(statusPanel);
            if (!archFrom.isEmpty()) {
                where.append(" AND s.archived_at >= ?");
                args.add(archFrom);
            }
            if (!archTo.isEmpty()) {
                where.append(" AND s.archived_at < DATEADD(day, 1, ?)");
                args.add(archTo);
            }
            where.append(")");
        }

        // CAST 统一为 nvarchar:date 类型的组列(如 bd_manu_order.合同号)与 doc_no 比较时不会隐式转换失败
        where.append(" AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = ? AND s.doc_no = CAST(t.[")
                .append(g).append("] AS nvarchar(100)) AND s.canceled = 'Y')");
        args.add(statusPanel);

        Integer total = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT t.[" + g + "]) FROM " + docTable + " t " + where,
                Integer.class, args.toArray());

        // 只要「共 N 条」(参照取数只要行数):不再跑分页单号查询与头/行两次取数
        if (countOnly) {
            Map<String, Object> counted = new HashMap<>();
            counted.put("totalSize", total == null ? 0 : total);
            counted.put("list", List.of());
            return counted;
        }

        // 默认排序:创建时间(asp_time1)倒序 = 最新单据在第一页 / 左栏「单据选择」顶部(2026-09-20 起全面板统一)。
        // 旧写法按组列(单据编号)字符串降序,只在单号零填充时才等价于"最新在上":一旦混入外部系统单号
        // (金蝶星辰同步的 SO_ORDER/PU_ORDER,如 ZXL25041701 与 ZXL-20260914-02)或历史前缀单
        // (如 TCGRK-* 与 PI-* 混排,'T' > 'P')就会把老单顶到第一页、新单挤到第二页。
        // GROUP BY 后 ORDER BY 只能引用分组列或聚合:
        //   MAX(asp_time1) DESC → 取组内最新时间(=该单创建时间);asp_time1 全空的单据排最后;
        //   单据编号 DESC 兜底 → 同一秒并列时排序稳定,保证 OFFSET/FETCH 分页不重不漏。
        // 默认排序(2026-10-14 用户口径「应该最新的单据日期在最上面」):
        //   **单据日期 DESC** → 次 asp_time1 DESC(同日按录入时间)→ 组列 DESC 兜底(分页稳定)。
        //   旧写法只按 MAX(asp_time1) DESC(=同步/创建时间),金蝶同步进来的单据按**拉取顺序**排,
        //   于是最老的单据反而排在第一页(实测:SO_ORDER 首行 2026-09-01)。
        //   ⚠ 日期列必须先确认在该表上存在,否则盲写会把列表打挂(报「列名无效」)。
        String dateCol = def.dateCol();
        boolean hasDate = false;
        if (dateCol != null && !dateCol.isBlank()) {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?",
                    Integer.class, "dbo." + docTable, dateCol);
            hasDate = n != null && n > 0;
        }
        String orderBy = (hasDate ? "MAX(t.[" + dateCol + "]) DESC, " : "")
                + "MAX(t.asp_time1) DESC, t.[" + g + "] DESC";
        String pageSql = "SELECT t.[" + g + "] AS __no FROM " + docTable + " t " + where
                + " GROUP BY t.[" + g + "]"
                + " ORDER BY " + orderBy
                + " OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add((pageNo - 1) * pageSize);
        pageArgs.add(pageSize);
        List<String> docNos = jdbc.query(pageSql, (rs, i) -> rs.getString(1), pageArgs.toArray());

        Map<String, Object> out = new HashMap<>();
        out.put("totalSize", total == null ? 0 : total);
        out.put("list", docNos.isEmpty() ? List.of() : loadDocs(def, docNos));
        return out;
    }

    /** 取一批单号的完整单据(头+明细),保持入参顺序 */
    public List<Map<String, Object>> loadDocs(PanelRegistry.PanelDef def, List<String> docNos) {
        if (docNos.isEmpty()) return List.of();
        boolean split = def.hasHeadTable();
        String g = def.groupCol();
        String in = String.join(",", docNos.stream().map(n -> "?").toList());

        // 明细行(行表):单表式选全部字段列,头行式选明细列
        List<PanelRegistry.FieldDef> lineCols = split ? def.fieldsAt("detail") : def.fields();
        String lineSql = "SELECT t.id AS __id, t.[" + g + "] AS __no, " + selectCols(def, lineCols, null)
                + " FROM " + def.lineTable() + " t WHERE t.[" + g + "] IN (" + in + ")"
                + " AND " + cancelFilter(def.lineTable()) + " ORDER BY t.[" + g + "], t.id";
        List<Map<String, Object>> lineRows = jdbc.queryForList(lineSql, docNos.toArray());

        Map<String, List<Map<String, Object>>> byDoc = new LinkedHashMap<>();
        for (String no : docNos) byDoc.put(no, new ArrayList<>());
        for (Map<String, Object> r : lineRows) {
            byDoc.computeIfAbsent(String.valueOf(r.get("__no")), k -> new ArrayList<>())
                    .add(rowToLabels(def, r, true));
        }

        // 头表(头行式)
        Map<String, Map<String, Object>> headRows = new HashMap<>();
        if (split) {
            String headSql = "SELECT t.id AS __id, t.[" + g + "] AS __no, " + selectCols(def, def.fieldsAt("header"), null)
                    + " FROM " + def.headTable() + " t WHERE t.[" + g + "] IN (" + in + ")";
            for (Map<String, Object> r : jdbc.queryForList(headSql, docNos.toArray())) {
                headRows.put(String.valueOf(r.get("__no")), r);
            }
        }

        Map<String, Map<String, Object>> status = loadStatus(def.code(), docNos);

        List<Map<String, Object>> docs = new ArrayList<>();
        for (String no : byDoc.keySet()) {
            List<Map<String, Object>> items = byDoc.get(no);
            Map<String, Object> doc = new LinkedHashMap<>();
            Map<String, Object> headRow = headRows.get(no);
            if (headRow != null) {
                doc.putAll(rowToLabels(def, headRow, false));
            } else if (!items.isEmpty()) {
                Map<String, Object> first = items.get(0);
                for (PanelRegistry.FieldDef f : def.fieldsAt("header")) {
                    if (first.containsKey(f.label())) doc.putIfAbsent(f.label(), first.get(f.label()));
                }
            }
            doc.put("编号", no);
            Map<String, Object> st = status.get(no);
            String statusText = docStatus(st);
            doc.put("单据状态", statusText);
            doc.put("saved", st != null ? st.get("saved") : null);
            doc.put("detail", Map.of("items", items));
            if (st != null && st.get("shr") != null) {
                // 质量单据(2026-10-04 两级审批)例外:它的「审核人/审核时间」是**表内真值** ——
                // 一级审批通过时写纸面「审核」格(一级审核人),「批准」另落 审批人。
                // 本虚拟字段覆盖会把两者都换成 yj_doc_status.shr(最终审批人 = 超级管理员**账号**),
                // 既抹掉一级审核人、又把账号名当人名显示(实测界面「审核」格变成 "admin")。
                // 故这些面板跳过覆盖;存量单(两级口径上线前审的)表内为空时才退回 shr 兜底。
                if (isTwoLevelSignPanel(def.code())) {
                    Object cellAuditor = doc.get("审核人");
                    if (cellAuditor == null || String.valueOf(cellAuditor).isBlank()) {
                        doc.put("审核人", st.get("shr"));
                        doc.put("审核时间", auditTimeText(st.get("shsj")));
                    }
                } else {
                    doc.put("审核人", st.get("shr"));
                    doc.put("审核时间", auditTimeText(st.get("shsj")));
                }
                doc.put("审批状态", "已通过");
            } else if ("审批中".equals(statusText)) {
                doc.put("审批状态", "审批中");
                doc.put("提交人", st.get("pending_by"));
                doc.put("提交时间", auditTimeText(st.get("pending_at")));
            }
            docs.add(doc);
        }
        return docs;
    }

    /** 取一张单据(getFormDescriptor 用) */
    public Map<String, Object> loadOneDoc(PanelRegistry.PanelDef def, String docNo) {
        List<Map<String, Object>> docs = loadDocs(def, List.of(docNo));
        if (docs.isEmpty()) throw new IllegalArgumentException("表单数据不存在：" + docNo);
        return docs.get(0);
    }

    private Map<String, Map<String, Object>> loadStatus(String panelCode, List<String> docNos) {
        String in = String.join(",", docNos.stream().map(n -> "?").toList());
        // 副本面板(供应商采购打印)的状态行记在源面板(采购订单)名下,见 PanelAliases:
        // 不折算 ⇒ 列表里每张单都查不到状态,「单据状态」恒为「草稿」、审核人/审核时间全空。
        final String statusPanelCode = com.yinjia.mes.panel.PanelAliases.statusSource(panelCode);
        List<Object> args = new ArrayList<>(List.of(statusPanelCode));
        args.addAll(docNos);
        Map<String, Map<String, Object>> out = new HashMap<>();
        jdbc.query("SELECT doc_no, shr, shsj, canceled, stopped, pending, pending_by, pending_at, archived, deleting, modify_state, saved, approve_node, l2_approver, effective, erp_close_state FROM yj_doc_status"
                + " WHERE panel_code = ? AND doc_no IN (" + in + ")", rs -> {
            Map<String, Object> m = new HashMap<>();
            m.put("shr", rs.getString("shr"));
            m.put("shsj", rs.getTimestamp("shsj"));
            m.put("canceled", rs.getString("canceled"));
            m.put("stopped", rs.getString("stopped"));
            m.put("erp_close_state", rs.getString("erp_close_state"));
            m.put("pending", rs.getString("pending"));
            m.put("pending_by", rs.getString("pending_by"));
            m.put("pending_at", rs.getTimestamp("pending_at"));
            m.put("archived", rs.getString("archived"));
            m.put("deleting", rs.getString("deleting"));
            m.put("modify_state", rs.getString("modify_state"));
                m.put("saved", rs.getString("saved"));
            m.put("approve_node", rs.getObject("approve_node"));
            m.put("l2_approver", rs.getString("l2_approver"));
            m.put("effective", rs.getString("effective"));
            out.put(rs.getString("doc_no"), m);
        }, args.toArray());
        // 产品变更申请单:会签中判据 = 还有 PENDING 签名(yj_form_approval,照 RD_PLAN 终止状态的补法)
        if ("RD_CHANGE".equals(panelCode)) {
            jdbc.query("SELECT DISTINCT form_no FROM yj_form_approval WHERE panel_code = 'RD_CHANGE' AND action = 'SIGNOFF'"
                    + " AND result = 'PENDING' AND form_no IN (" + in + ")", rs -> {
                Map<String, Object> m = out.get(rs.getString("form_no"));
                if (m != null) m.put("signoff_pending", "Y");
            }, docNos.toArray());
        }
        // 项目实施计划:补终止审批状态(yj_plan_term,一单一行;RTRIM 防 char(2) 尾空格)
        if ("RD_PLAN".equals(panelCode)) {
            jdbc.query("SELECT doc_no, RTRIM(state) AS term_state FROM yj_plan_term WHERE panel_code='RD_PLAN' AND doc_no IN (" + in + ")",
                    rs -> {
                        Map<String, Object> m = out.get(rs.getString("doc_no"));
                        if (m != null) m.put("term_state", rs.getString("term_state"));
                    }, docNos.toArray());
        }
        return out;
    }

    /** 状态推导:已作废 > 已中止 > 删除申请中 > 已终止/终止审批中(项目实施计划) > 修改申请中 > 待二级审批/审批中 > 修改中 > 已生效 > 已归档 > 已完成(金蝶自动关单) > 已审核 > 草稿
     *  ⚠ 与 ButtonService.docStatusOf **必须同改**(两处推导,一处管列表行、一处管按钮/保存门禁;
     *    2026-09-20 两级审批新增「待二级审批」时同改两处)。 */
    private String docStatus(Map<String, Object> st) {
        if (st != null && "Y".equals(st.get("canceled"))) return "已作废";
        if (st != null && "Y".equals(st.get("stopped"))) return "已中止";
        // 金蝶「手动关闭」(erp_close_state='H')= 人工终止,与 MES 中止同义(方案 A,2026-09-20)
        if (st != null && "H".equals(st.get("erp_close_state"))) return "已中止";
        if (st != null && "Y".equals(st.get("deleting"))) return "删除申请中";
        // 项目实施计划:终止二级审批(P1 待立项人/P2 待管理员/T 已终止)
        if (st != null && "T".equals(st.get("term_state"))) return "已终止";
        if (st != null && "P2".equals(st.get("term_state"))) return "终止审批中（管理员）";
        if (st != null && "P1".equals(st.get("term_state"))) return "终止审批中（立项人）";
        if (st != null && "R".equals(st.get("modify_state"))) return "修改申请中";
        if (st != null && "Y".equals(st.get("signoff_pending"))) return "会签中";
        if (st != null && "Y".equals(st.get("pending"))) {
            return l2Node(st) ? "待二级审批" : "审批中";
        }
        if (st != null && "Y".equals(st.get("modify_state"))) return "修改中";
        if (st != null && "Y".equals(st.get("effective"))) return "已生效";
        if (st != null && "Y".equals(st.get("archived"))) return "已归档";
        // 金蝶「已关闭」(erp_close_state='S')= 下游单据全部执行完系统自动关单,业务上是"做完了"
        if (st != null && "S".equals(st.get("erp_close_state"))) return "已完成";
        if (st != null && st.get("shr") != null) return "已审核";
        return "草稿";
    }

    /** approve_node=2 ⇒ 二级节点(空/1 都是一级) */
    private static boolean l2Node(Map<String, Object> st) {
        Object v = st.get("approve_node");
        return v != null && "2".equals(String.valueOf(v).trim().replace(".0", ""));
    }

    // ============ 公共 ============

    /**
     * 派生列「面板名称」的标签(该面板有这一字段且表上没有同名物理列时返回其 label,否则 null)。
     * 目前唯一使用者 = 数据建模 · 字段管理 FIELDMGR(yj_field 没有面板名称列,按 panel_code 关联 yj_panel)。
     */
    private String derivedPanelNameLabel(PanelRegistry.PanelDef def) {
        if (def == null || def.codeCol() == null || def.codeCol().isBlank()) return null;
        PanelRegistry.FieldDef f = def.byLabel("面板名称");
        if (f == null) return null;
        if (tableHasColumn(def.lineTable(), f.col())) return null;
        return f.label();
    }

    private final java.util.concurrent.ConcurrentHashMap<String, Boolean> HAS_COL_CACHE =
            new java.util.concurrent.ConcurrentHashMap<>();

    /** 表上是否有该物理列(按 表|列 缓存) */
    private boolean tableHasColumn(String table, String col) {
        if (table == null || table.isBlank() || col == null || col.isBlank()) return false;
        return HAS_COL_CACHE.computeIfAbsent(table + "|" + col, k -> {
            try {
                Integer n = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = ?",
                        Integer.class, "dbo." + table, col);
                return n != null && n > 0;
            } catch (Exception e) {
                return true;
            }
        });
    }

    /**
     * 表上有没有 作废标记列 {@code asp_cancel}(结果按表名缓存;启动后表结构不会变)。
     *
     * <p>为什么会有"没有"的表(2026-10-18,字段管理 FIELDMGR 上线时实测 500):
     * 单据/档案/平表三种取数都以 {@code WHERE ISNULL(t.asp_cancel,'N')<>'Y'} 开头 —— 这是全站默认
     * **软删除**口径,业务表(bs_/bd_/bl_/视图)都有这一列。但**元数据表本身**不一定有:
     * {@code yj_field} 就没有 asp_cancel(字段下线走 retireExtField,不是打标记),
     * 于是一打开「数据建模 · 字段管理」就是「列名 'asp_cancel' 无效」。
     * 数据模板(RowSource/convenience 视图)也可能没有 ⇒ 一律按表结构判定,有才过滤。
     */
    private String cancelFilter(String table) {
        if (table == null || table.isBlank()) return "1=1";
        boolean has = CANCEL_COL_CACHE.computeIfAbsent(table, tb -> {
            try {
                Integer n = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND name = N'asp_cancel'",
                        Integer.class, "dbo." + tb);
                return n != null && n > 0;
            } catch (Exception e) {
                return true;   // 查不出来就按"有"处理(与历史行为一致)
            }
        });
        return has ? "ISNULL(t.asp_cancel,'N')<>'Y'" : "1=1";
    }

    private final java.util.concurrent.ConcurrentHashMap<String, Boolean> CANCEL_COL_CACHE =
            new java.util.concurrent.ConcurrentHashMap<>();

    /** 生成 SELECT 列(col AS 中文标签);列名含特殊字符(%、.、空格等)必须方括号包裹。
     *  derived = 派生列标签(表上没有物理列,由 JOIN 带出):这里跳过,由调用方按自己的关联补 SELECT。
     *  不跳过就会连成 `t.[panel_name] AS [面板名称]` ⇒ 列名无效(2026-10-18 实测)。 */
    private String selectCols(PanelRegistry.PanelDef def, List<PanelRegistry.FieldDef> fields, String derived) {
        StringBuilder sb = new StringBuilder();
        for (PanelRegistry.FieldDef f : fields) {
            if (derived != null && derived.equals(f.label())) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append("t.[").append(f.col()).append("] AS [").append(f.label()).append("]");
        }
        return sb.length() == 0 ? "t.*" : sb.toString();
    }

    /** 行 -> 标签键映射(+id/__no) */
    private Map<String, Object> rowToLabels(PanelRegistry.PanelDef def, Map<String, Object> row, boolean withId) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (withId && row.get("__id") != null) out.put("id", row.get("__id"));
        for (PanelRegistry.FieldDef f : def.fields()) {
            Object v = row.get(f.label());
            if (v != null) out.put(f.label(), dateWallText(f.dataType(), v));
        }
        return out;
    }

    /**
     * 日期类字段(日期/日期时间/时间)的值 → **本地墙钟文本**,再下发前端。
     *
     * 为什么必须在这一层转(2026-10-07 用户报错取证):
     *   服务器上不少日期列是 datetime/date(旧系统直改存量,如 rd_instr_use_detail.使用日期),
     *   JDBC 取回 java.sql.Timestamp/Date,Jackson 按 UTC 序列化成
     *   `2026-10-05T16:00:00.000+00:00` —— 而库里存的是**本地墙钟** 2026-10-06 00:00。
     *   前端按字面取日期就成了前一天(用户口径:「我写的6号,实际保存变成了5号」),
     *   原样回传还会把值再往前挪一天(日期选择器同样按前 10 字符解析)。
     *   ⇒ 在这里转成 'yyyy-MM-dd'(与 dev/测试库 nvarchar 文本列的口径**完全一致**)后,
     *   列表、表单、打印、回写四条路都对得上。
     *
     * 只认 data_type 精确等于 日期/日期时间/时间;文本/下拉框/参照/时间区间等一律原样返回
     * (dev 库里日期字段本来就是文本,走到这里已是 String,不做任何加工)。
     */
    static Object dateWallText(String dataType, Object v) {
        if (v == null) return null;
        String t = dataType == null ? "" : dataType.trim();
        boolean dateOnly = "日期".equals(t);
        boolean dateTime = "日期时间".equals(t);
        boolean timeOnly = "时间".equals(t);
        if (!dateOnly && !dateTime && !timeOnly) return v;
        try {
            if (v instanceof java.sql.Timestamp ts) {
                java.time.LocalDateTime d = ts.toLocalDateTime();
                return dateTime ? d.format(DT_FMT) : dateOnly ? d.format(D_FMT) : d.format(T_FMT);
            }
            if (v instanceof java.sql.Date d) {
                java.time.LocalDate ld = d.toLocalDate();
                return dateTime ? ld.atStartOfDay().format(DT_FMT) : dateOnly ? ld.format(D_FMT) : ld.atStartOfDay().format(T_FMT);
            }
            if (v instanceof java.sql.Time tm) {
                java.time.LocalTime lt = tm.toLocalTime();
                return dateTime ? java.time.LocalDate.now() + " " + lt.format(T_FMT) : dateOnly ? lt.format(D_FMT) : lt.format(T_FMT);
            }
            if (v instanceof java.time.LocalDateTime d) {
                return dateTime ? d.format(DT_FMT) : dateOnly ? d.format(D_FMT) : d.format(T_FMT);
            }
            if (v instanceof java.time.LocalDate d) {
                return dateTime ? d.atStartOfDay().format(DT_FMT) : dateOnly ? d.format(D_FMT) : d.atStartOfDay().format(T_FMT);
            }
            if (v instanceof java.time.LocalTime t2) {
                return t2.format(T_FMT);
            }
        } catch (RuntimeException e) {
            // 取不出来(异常日期)就原样下发:宁可前端显示怪值,也不能把整张列表打挂
            return v;
        }
        return v;
    }

    /**
     * 审核时间 / 提交时间(yj_doc_status.shsj / pending_at)→ **本地墙钟文本**,再下发前端。
     *
     * 为什么要单独一个方法(2026-10-18 用户报障「审核时间显示时区偏 8 小时」):
     *   这两个值**不是 yj_field 里的字段**,而是由 yj_doc_status 合成出来的虚拟字段,
     *   走 `rowToLabels` 那条路(→ {@link #dateWallText})—— 而 dateWallText 是按 data_type
     *   判断的('日期'/'日期时间'/'时间'),虚拟字段根本没有 data_type ⇒ 原样返回 Timestamp,
     *   Jackson 按 UTC 序列化成 `2026-10-18T08:08:21.573+00:00`,而库里存的是本地墙钟 16:08。
     *   ⇒ 与 dateWallText 同口径转成 'yyyy-MM-dd HH:mm:ss'(列表底栏/表单/打印都按字面显示)。
     */
    static String auditTimeText(Object v) {
        if (v == null) return null;
        try {
            if (v instanceof java.sql.Timestamp ts) return ts.toLocalDateTime().format(DT_FMT);
            if (v instanceof java.sql.Date d) return d.toLocalDate().atStartOfDay().format(DT_FMT);
            if (v instanceof java.time.LocalDateTime d) return d.format(DT_FMT);
            if (v instanceof java.time.LocalDate d) return d.atStartOfDay().format(DT_FMT);
            if (v instanceof java.util.Date d) return new java.sql.Timestamp(d.getTime()).toLocalDateTime().format(DT_FMT);
        } catch (RuntimeException e) {
            return String.valueOf(v);
        }
        return String.valueOf(v);
    }

    private static final java.time.format.DateTimeFormatter D_FMT =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final java.time.format.DateTimeFormatter DT_FMT =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final java.time.format.DateTimeFormatter T_FMT =
            java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss");

    /** 直接列过滤(档案模式) */
    private void appendDirectFilters(PanelRegistry.PanelDef def, String table, StringBuilder where,
                                     List<Object> args, String keyword, Map<String, Object> condition,
                                     Map<String, String> l2c, String alias) {
        if (condition != null) {
            // 仓库下拉(库存状况):按仓库编码(ckdm)精确过滤(_ckdm);绑定编码,仓库字典改名不影响
            Object ck = condition.get("_ckdm");
            if (ck != null && !String.valueOf(ck).isBlank()) {
                where.append(" AND ").append(alias).append(".[ckdm] = ?");
                args.add(String.valueOf(ck).trim());
            }
            // 仓库/存货:名称(业务字段) 还是 编码(控制键)?
            //
            // 口径(2026-10-20 定,统一台账/库存状况/收发存汇总):
            //   ① 控制键 `_whCode`/`_itemCode` 是**编码**的权威来源(查询弹窗选参照时绑定编码);
            //   ② 没有控制键时,名称位里若放的**本身就是编码**也认(参照回填/查询方案里可能是码);
            //   ③ 其余情况按**名称精确等值**(参照字段从不做 LIKE —— 子串会串仓:「成品仓」会命中「半成品仓」,
            //      台账实测 93 行 = 34 + 59,按仓分户的口径直接失真)。
            //
            // ⚠ 事故(2026-10-20 用户报「库存台账查询只剩期初/期末两行」):
            //   原实现把 `condition['仓库']/['存货']` **一律当编码**比(`RTRIM(t.[仓库编码]) = 值`),
            //   而弹窗里这两格放的是**名称**(弹窗回显 + 参照 label)⇒ 名称拿去和编码比 ⇒ 恒 0 行,
            //   只剩两行合成行;更糟的是配套的 `_whCode` 分支有前置条件
            //   `l2c.containsKey("仓库编码")`,而台账的「仓库编码」字段 place=detail、不进查询字段表
            //   ⇒ l2c 里没有这个标签 ⇒ **编码过滤一次都没生效过**(见 tools/archive/_stockreport-dialog-1020/)。
            //   现在把名称/编码判据收敛成上面一条:编码优先、退化名称,两块面板同一口径。
            Object whCode = condition.get("_whCode");
            String whName = strOf(condition.get("仓库"));
            // 多仓库过滤(2026-10-15,库存明细左侧「分仓库选择」):`_whCodes` = 逗号分隔的仓库编码列表 ⇒ IN(...)。
            // 为什么单独一个键:通用条件一次只表达一个值(名称/编码),而左侧列表是多选;
            //   沿用 `_` 前缀的「控制键」口径(与 _ckdm/_whCode/_itemCode 同族),不污染业务字段名。
            // ⚠ **按面板闸门**:只有 STOCK_DETAIL(自带左栏分仓库列表)认这个键 —— 否则一旦别的面板
            //   (库存状况表/台账/汇总都有「仓库编码」列)收到残留的 _whCodes,就会被静默过滤成 0 行。
            //   2026-10-15 用户报「库存明细的查询会影响到库存状况表」,这条闸门 + 前端「请求时派生」一起兜住。
            String whCol = l2c.getOrDefault("仓库编码", l2c.get("仓库"));
            Object whCodes = condition.get("_whCodes");
            if (whCodes != null && !String.valueOf(whCodes).isBlank() && whCol != null
                    && WH_DOCK_PANELS.contains(def.code())) {
                List<String> codes = new ArrayList<>();
                for (String s : String.valueOf(whCodes).split(",")) {
                    String t = s.trim();
                    if (!t.isEmpty()) codes.add(t);
                }
                if (!codes.isEmpty()) {
                    where.append(" AND RTRIM(").append(alias).append(".[").append(whCol).append("]) IN (")
                            .append(String.join(",", java.util.Collections.nCopies(codes.size(), "?"))).append(")");
                    args.addAll(codes);
                    // 已按编码 IN 过滤 ⇒ 名称条件不再叠加。
                    // ⚠ 2026-10-20 用户报「勾选仓库报错」:这里原来赋的是 **null**,而下面
                    //    `byWh = ... || !whName.isEmpty()` 直接解引用 ⇒ NPE「Cannot invoke String.isEmpty()
                    //    because "whName" is null」。空串与 null 在下游(appendWhItemFilter)语义完全相同
                    //    ("没有名称条件"),故一律用空串,别再让这里产生可空值。
                    whName = "";
                }
            }
            Object itemCode = condition.get("_itemCode");
            String itemName = strOf(condition.get("存货"));
            // `_` 开头的是控制键(已在上面各自处理),不进下面的通用循环,免得被当字段名 LIKE
            // 名称列:多数面板叫「仓库」/「存货」,但**库存明细(STOCK_DETAIL)** 的字段是
            // 「仓库名称」/「存货名称」—— 只认「仓库」会让该面板的名称条件退化成"没有列可过滤"
            // (2026-10-20 实测:condition.仓库=恒亿仓 返回 0 行)。故按优先级取第一个存在的列。
            //
            // 编码列同样**不能写死**「仓库编码」(2026-10-20 用户勾选仓库报错时顺带查出):
            // 库存状况(STOCK_STATUS)的表是 kucun,列名是 `ckdm`/`wzdm`,字段标签才叫「仓库」「存货」
            // ⇒ 硬编码 "仓库编码" 拼出 `RTRIM(t.[仓库编码])` = 「列名 '仓库编码' 无效」直接 500。
            // 口径:编码列 = 面板里「仓库编码」→「仓库」→「ckdm」中第一个存在的标签所映射的列;
            //       存货同理(「存货编码」→「存货」→「wzdm」)。都取不到 = 该面板没有编码列,退到名称列。
            String whCodeCol = firstCol(l2c, "仓库编码", "仓库", "ckdm");
            String itemCodeCol = firstCol(l2c, "存货编码", "存货", "wzdm");
            String whColForName = firstCol(l2c, "仓库", "仓库名称");
            String itemColForName = firstCol(l2c, "存货", "存货名称");
            // 名称列与编码列是同一列(如库存状况 label 仓库→ckdm)⇒ 名称位按"是不是编码"的轻判据走,
            // 不要把名称当独立列再拼一次(那会拼出两个互相矛盾的等值条件)。
            if (whColForName != null && whColForName.equals(whCodeCol)) whColForName = null;
            if (itemColForName != null && itemColForName.equals(itemCodeCol)) itemColForName = null;
            appendWhItemFilter(where, args, alias, table, whCodeCol, whColForName, strOf(whCode), whName,
                    new String[]{"bs_wh", "仓库名称", "仓库编码"});
            appendWhItemFilter(where, args, alias, table, itemCodeCol, itemColForName, strOf(itemCode), itemName,
                    new String[]{"bs_inv", "存货名称", "存货编码"});
            // 兜底再判一次空(null = 没有名称条件),不要再出现"靠上层保证非 null"的写法(2026-10-20 NPE)
            boolean byWh = strOf(whCode).length() > 0 || (whName != null && !whName.isEmpty());
            boolean byItem = strOf(itemCode).length() > 0 || (itemName != null && !itemName.isEmpty());
            // 报表日期段(查询弹窗):开始/结束日期 → 区间过滤。
            // 有 期次 列(收发存汇总)按月(yyyy-MM)闭区间;否则有 单据日期 列(库存台账)按全日期闭区间。
            // 这两个键不进通用 LIKE,下方的 l2c 兜底也会因无列名而跳过。
            String rangeCol = l2c.containsKey("期次") ? "期次" : (l2c.containsKey("单据日期") ? "单据日期" : null);
            boolean byMonth = "期次".equals(rangeCol);
            Object qs = condition.get("开始日期");
            if (rangeCol != null && qs != null && !String.valueOf(qs).isBlank()) {
                String v = String.valueOf(qs).trim();
                where.append(" AND ").append(alias).append(".[").append(rangeCol).append("] >= ?");
                args.add(byMonth && v.length() > 7 ? v.substring(0, 7) : v);
            }
            Object qe = condition.get("结束日期");
            if (rangeCol != null && qe != null && !String.valueOf(qe).isBlank()) {
                String v = String.valueOf(qe).trim();
                where.append(" AND ").append(alias).append(".[").append(rangeCol).append("] <= ?");
                args.add(byMonth && v.length() > 7 ? v.substring(0, 7) : v);
            }
            for (Map.Entry<String, Object> e : condition.entrySet()) {
                String key = e.getKey();
                if (key != null && key.startsWith("_")) continue; // 控制键(_whCode/_itemCode/_whCodes/_ckdm/_docNo…)
                String col = l2c.get(key);
                Object v = e.getValue();
                if (col == null || v == null || String.valueOf(v).isBlank()) continue;
                if ("开始日期".equals(key) || "结束日期".equals(key)) continue; // 已按期次区间处理
                // 仓库/存货已由 appendWhItemFilter 按「编码优先、退化名称」处理完毕(前端仍回显名称,不重复叠加)
                if ("仓库".equals(key) && byWh) continue;
                if ("存货".equals(key) && byItem) continue;
                // 参照字段(2026-09-24):查询值来自档案参照/联动下拉,是「一个精确实体」而非关键字 → 等值匹配。
                // LIKE 子串会串仓:仓库「成品仓」会同时命中「半成品仓」、「不良品仓」命中「原料不良品仓」
                // (库存台账实测:查 成品仓 返回 93 行 = 成品仓 34 + 半成品仓 59,台账按仓分户的口径直接失真)。
                // 文本字段保持模糊;RTRIM 防 nchar/手工导入尾随空格(与台账联动选项同款口径)。
                PanelRegistry.FieldDef fd = def.byLabel(key);
                if (fd != null && "参照".equals(fd.dataType())) {
                    where.append(" AND RTRIM(").append(alias).append(".[").append(col).append("]) = ?");
                    args.add(String.valueOf(v).trim());
                } else {
                    where.append(" AND ").append(alias).append(".[").append(col).append("] LIKE ?");
                    args.add("%" + v + "%");
                }
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            StringBuilder or = new StringBuilder();
            List<Object> kargs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : def.fields()) {
                or.append(or.length() > 0 ? " OR " : "").append(alias).append(".[").append(f.col()).append("] LIKE ?");
                kargs.add("%" + keyword + "%");
            }
            if (or.length() > 0) {
                where.append(" AND (").append(or).append(")");
                args.addAll(kargs);
            }
        }
    }

    /**
     * 「仓库 / 存货」这一维的过滤条件:编码优先、退化名称(口径见 {@link #appendDirectFilters} 的长注释)。
     *
     * <ul>
     *   <li>有编码 ⇒ {@code RTRIM(仓库编码) = 编码}(唯一,不受重名/改名影响);</li>
     *   <li>没编码但有名称 ⇒ 名称位若**本身就是编码**则按编码比(参照回填/查询方案里存的是码),
     *       否则 {@code RTRIM(仓库) = 名称} 精确等值(绝不 LIKE:子串会串仓);</li>
     *   <li>码列名/名列名任一缺失 → 退到另一侧,都缺就不过滤(与历史"面板没有对应列时不生效"一致)。</li>
     * </ul>
     *
     * @param codeCol 编码列名(可为 null = 该面板没有编码列)
     * @param nameCol 名称列名(可为 null)
     * @param code    控制键里的编码(空串 = 没有)
     * @param name    名称位里的值(null/空 = 没有)
     */
    private void appendWhItemFilter(StringBuilder where, List<Object> args, String alias, String table,
                                    String codeCol, String nameCol, String code, String name) {
        appendWhItemFilter(where, args, alias, table, codeCol, nameCol, code, name, null);
    }

    /**
     * 同上,多一个 `archive` 参数:**面板只有编码列**时,用档案把"名称"翻成编码(2026-10-20)。
     *
     * <p>为什么需要:库存状况(STOCK_STATUS)的表是 `kucun`,只有 `ckdm`/`wzdm`(编码),没有名称列。
     * 用户在那个面板按「仓库=恒亿仓」查时,旧行为是拿名称去和编码比 ⇒ **恒 0 行**
     * (或按历史兜底,值恰好是编码时才对)。有了这一跳:名称 → `bs_wh.仓库编码` / `bs_inv.存货编码` ⇒ 按编码比,
     * 名称与编码两种输入都对。
     *
     * @param archive {档案表, 名称列, 编码列};null = 不做名称→编码翻译
     */
    private void appendWhItemFilter(StringBuilder where, List<Object> args, String alias, String table,
                                    String codeCol, String nameCol, String code, String name, String[] archive) {
        String c = code == null ? "" : code.trim();
        String n = name == null ? "" : name.trim();
        if (!c.isEmpty() && codeCol != null) {
            where.append(" AND RTRIM(").append(alias).append(".[").append(codeCol).append("]) = ?");
            args.add(c);
            return;
        }
        if (n.isEmpty()) return;
        if (codeCol != null && looksLikeCodeOf(nameCol, n, table, codeCol).test) {
            // 名称位放的其实是编码(参照回填/查询方案):按编码比
            where.append(" AND RTRIM(").append(alias).append(".[").append(codeCol).append("]) = ?");
            args.add(n);
            return;
        }
        if (nameCol != null) {
            where.append(" AND RTRIM(").append(alias).append(".[").append(nameCol).append("]) = ?");
            args.add(n);
            return;
        }
        if (codeCol != null) {
            // 面板只有编码列:先试"名称 → 档案编码",翻不出来再按原样兜底(历史行为,不回归成"查不出")
            String resolved = archive == null ? null : resolveByNameFromArchive(archive, n);
            where.append(" AND RTRIM(").append(alias).append(".[").append(codeCol).append("]) = ?");
            args.add(resolved == null || resolved.isEmpty() ? n : resolved);
        }
    }

    /** 名称 → 档案编码(bs_wh.仓库名称→仓库编码 / bs_inv.存货名称→存货编码);查不到返回 null。 */
    private String resolveByNameFromArchive(String[] archive, String name) {
        try {
            List<String> hit = jdbc.queryForList(
                    "SELECT TOP 1 [" + archive[2] + "] FROM [" + archive[0] + "] WHERE [" + archive[1] + "] = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", String.class, name);
            return hit.isEmpty() ? null : hit.get(0);
        } catch (Exception e) {
            return null;   // 档案表/列缺失 → 按原样兜底,不阻断查询
        }
    }

    /** 标签→列名表里**按优先级取第一个存在的列**(都缺返回 null = 该面板没有这一列)。
     *  用于「仓库/仓库名称」「存货/存货名称」这类同义标签不同名的面板(见 2026-10-20 库存明细 0 行)。 */
    private static String firstCol(Map<String, String> l2c, String... labels) {
        for (String lab : labels) {
            String col = l2c.get(lab);
            if (col != null && !col.isBlank()) return col;
        }
        return null;
    }

    /** 「这个值是不是编码」的轻判据:名称列里查不到这个值 ⇒ 当编码看。
     *  结果按 (表, 列, 值) 缓存 60s —— 参照回填/查询方案会反复带同一个值。 */
    private record CodeLike(boolean test, long at) { }

    private final java.util.concurrent.ConcurrentHashMap<String, CodeLike> CODE_LIKE_CACHE =
            new java.util.concurrent.ConcurrentHashMap<>();

    private CodeLike looksLikeCodeOf(String nameCol, String value, String table, String codeCol) {
        if (nameCol == null || codeCol == null || table == null) return new CodeLike(false, 0);
        String key = table + "|" + nameCol + "|" + codeCol + "|" + value;
        CodeLike hit = CODE_LIKE_CACHE.get(key);
        long now = System.currentTimeMillis();
        if (hit != null && now - hit.at() < 60_000) return hit;
        boolean isCode;
        try {
            Integer nan = jdbc.queryForObject("SELECT COUNT(*) FROM (SELECT TOP 1 1 AS x FROM " + table
                    + " WHERE RTRIM([" + nameCol + "]) = ?) z", Integer.class, value);
            isCode = nan == null || nan == 0;
        } catch (Exception ex) {
            isCode = false; // 判断不了就按名称走(历史口径),不至于把查询打挂
        }
        CodeLike fresh = new CodeLike(isCode, now);
        CODE_LIKE_CACHE.put(key, fresh);
        return fresh;
    }

    /**
     * 查询弹窗「高级筛选」→ WHERE。逐条 AND 组合(与前端 applyAdvFilters 的 every 语义一致),
     * 算子:contains(LIKE %v%) / eq、ne(去前后空格后按字符串比) / empty、notEmpty(空串判空)
     * / gt、lt、ge、le(两边都能当数字时按数值,否则按字符串比)。
     *
     * 与服务端 keyword、字段条件三者是 AND 关系;台账的期初/期末合成行按 仓库+存货+日期段
     * 另行聚合,不受这里影响(与 keyword 同款行为)。
     * 字段标签在本面板找不到列(改过名/来自别的面板)→ 跳过该行而非报错,避免旧查询方案打不开面板。
     */
    /**
     * 单据面板的高级筛选:头行单据仅放行「头表字段」(place=header/query 的标签),其余剔除;
     * 非头行单据(单表)全放行。算子/取值语义与平表完全相同(见 {@link #appendAdvFilters})。
     */
    private void appendAdvFiltersForDocs(PanelRegistry.PanelDef def, List<Map<String, Object>> advFilters,
                                         StringBuilder where, List<Object> args, Map<String, String> l2c,
                                         boolean split) {
        if (advFilters == null || advFilters.isEmpty()) return;
        List<Map<String, Object>> allow = advFilters;
        if (split) {
            java.util.Set<String> headLabels = new java.util.HashSet<>();
            for (PanelRegistry.FieldDef f : def.fieldsAt("header")) headLabels.add(f.label());
            for (PanelRegistry.FieldDef f : def.fieldsAt("query")) headLabels.add(f.label());
            allow = new ArrayList<>();
            for (Map<String, Object> f : advFilters) {
                if (f != null && headLabels.contains(strOf(f.get("field")))) allow.add(f);
            }
        }
        appendAdvFilters(allow, where, args, l2c, "t");
    }

    private void appendAdvFilters(List<Map<String, Object>> advFilters, StringBuilder where,
                                  List<Object> args, Map<String, String> l2c, String alias) {
        if (advFilters == null || advFilters.isEmpty()) return;
        StringBuilder and = new StringBuilder();
        List<Object> aargs = new ArrayList<>();
        for (Map<String, Object> f : advFilters) {
            if (f == null) continue;
            String col = l2c.get(strOf(f.get("field")));
            String op = strOf(f.get("op"));
            String val = strOf(f.get("value"));
            if (col == null || op.isEmpty()) continue;
            boolean valueless = "empty".equals(op) || "notEmpty".equals(op);
            if (!valueless && val.isEmpty()) continue; // 未填值的行不参与过滤(同前端)
            String c = alias + ".[" + col + "]";
            switch (op) {
                case "contains" -> {
                    and.append(" AND ").append(c).append(" LIKE ?");
                    aargs.add("%" + val + "%");
                }
                case "eq" -> {
                    and.append(" AND ").append(txtExpr(c)).append(" = ?");
                    aargs.add(val);
                }
                case "ne" -> {
                    and.append(" AND ").append(txtExpr(c)).append(" <> ?");
                    aargs.add(val);
                }
                case "empty" -> and.append(" AND ").append(txtExpr(c)).append(" = N''");
                case "notEmpty" -> and.append(" AND ").append(txtExpr(c)).append(" <> N''");
                case "gt", "lt", "ge", "le" -> {
                    String sym = switch (op) { case "gt" -> ">"; case "lt" -> "<"; case "ge" -> ">="; default -> "<="; };
                    String num = val.replace(",", ""); // 前端 parseFloat 前也去千分位
                    if (isNumeric(num)) {
                        and.append(" AND ").append(numExpr(c)).append(" ").append(sym).append(" ?");
                        aargs.add(Double.parseDouble(num));
                    } else {
                        and.append(" AND ").append(txtExpr(c)).append(" ").append(sym).append(" ?");
                        aargs.add(val);
                    }
                }
                default -> { /* 未知算子:不过滤(同前端兜底) */ }
            }
        }
        if (and.length() > 0) {
            where.append(and);
            args.addAll(aargs);
        }
    }

    /** 去前后空格的字符串形态:eq/ne/空判/字符串区间都比它,对齐前端 String(v).trim() */
    private String txtExpr(String col) {
        return "ISNULL(LTRIM(RTRIM(CAST(" + col + " AS nvarchar(4000)))),N'')";
    }

    /** 数值形态:比较值能当数字时用它。脏值(如 '暂无')经 TRY_CAST 变 NULL → 比较不成立、该行不命中;
     *  这种情况前端是退化成字符串比(可能命中),属已知的口径差 —— 数值列的脏值本来就不该参与数值比较。 */
    private String numExpr(String col) {
        return "TRY_CAST(REPLACE(" + txtExpr(col) + ",N',',N'') AS float)";
    }

    private boolean isNumeric(String s) {
        if (s.isEmpty()) return false;
        try {
            Double.parseDouble(s);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * 单据模式过滤:
     * - 头行式:头字段直接 t.col,行字段 EXISTS 行表
     * - 单表式:全部 EXISTS 行表(即 docTable 自身,按行匹配)
     */
    private void appendDocFilters(PanelRegistry.PanelDef def, StringBuilder where, List<Object> args,
                                  String keyword, Map<String, Object> condition, Map<String, String> l2c,
                                  boolean split, List<PanelRegistry.FieldDef> docCols, String docTable, String g) {
        List<PanelRegistry.FieldDef> lineFields = split ? def.fieldsAt("detail") : def.fields();
        boolean useExists = true; // 单表式也走 EXISTS(行级匹配语义更准)

        if (condition != null) {
            for (Map.Entry<String, Object> e : condition.entrySet()) {
                String col = l2c.get(e.getKey());
                Object v = e.getValue();
                if (col == null || v == null || String.valueOf(v).isBlank()) continue;
                boolean onDoc = split && docCols.stream().anyMatch(f -> f.col().equals(col));
                // 「审核人」是**虚拟字段**:显示值取自 yj_doc_status.shr(见 loadStatus),表内同名列对 MES 单据为空
                // (只有金蝶同步单才写列)。若只按列过滤,后端选了审核人也永远筛不出 MES 单据
                // → 过滤取两处并集(2026-09-20 配合「审核人绑职员」一起修)
                if (onDoc && "审核人".equals(e.getKey())) {
                    where.append(" AND (t.[").append(col).append("] LIKE ? OR EXISTS (SELECT 1 FROM yj_doc_status s")
                            .append(" WHERE s.panel_code = ? AND s.doc_no = CAST(t.[").append(g)
                            .append("] AS nvarchar(100)) AND s.shr LIKE ?))");
                    args.add("%" + v + "%");
                    // 副本面板按源面板的状态记账(同 loadStatus),否则按审核人永远搜不到
                    args.add(com.yinjia.mes.panel.PanelAliases.statusSource(def.code()));
                    args.add("%" + v + "%");
                } else if (onDoc) {
                    where.append(" AND t.").append(col).append(" LIKE ?");
                    args.add("%" + v + "%");
                } else if (lineFields.stream().anyMatch(f -> f.col().equals(col)) || !split) {
                    where.append(" AND EXISTS (SELECT 1 FROM ").append(def.lineTable()).append(" x WHERE x.")
                            .append(g).append(" = t.").append(g)
                            .append(" AND ISNULL(x.asp_cancel,'N')<>'Y' AND x.").append(col).append(" LIKE ?)");
                    args.add("%" + v + "%");
                }
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            StringBuilder or = new StringBuilder();
            List<Object> kargs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : docCols) {
                or.append(or.length() > 0 ? " OR " : "").append("t.[").append(f.col()).append("] LIKE ?");
                kargs.add("%" + keyword + "%");
            }
            StringBuilder lineOr = new StringBuilder();
            List<Object> largs = new ArrayList<>();
            for (PanelRegistry.FieldDef f : lineFields) {
                lineOr.append(lineOr.length() > 0 ? " OR " : "").append("x.[").append(f.col()).append("] LIKE ?");
                largs.add("%" + keyword + "%");
            }
            where.append(" AND (");
            if (or.length() > 0) {
                where.append("(").append(or).append(")");
                args.addAll(kargs);
                if (lineOr.length() > 0) where.append(" OR ");
            }
            if (lineOr.length() > 0) {
                where.append("EXISTS (SELECT 1 FROM ").append(def.lineTable()).append(" x WHERE x.").append(g)
                        .append(" = t.").append(g).append(" AND ISNULL(x.asp_cancel,'N')<>'Y' AND (")
                        .append(lineOr).append("))");
                args.addAll(largs);
            }
            where.append(")");
        }
    }
}
