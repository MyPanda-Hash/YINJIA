package com.yinjia.mes.controller;

import com.yinjia.mes.config.DataSourceRouter;
import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.DashboardStatsService;
import com.yinjia.mes.service.FlowBoardService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.QrBatchService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 门户壳接口:工厂列表/菜单/dashboard(角标与通知在 PortalController) */
@RestController
@RequestMapping("/api")
public class ShellController {

    private final PanelRegistry registry;
    private final JdbcTemplate jdbc;
    private final QrBatchService qrBatch;
    private final DashboardStatsService dashboardStats;
    private final FlowBoardService flowBoard;
    private final String factoryName;
    private final String testFactoryName;
    /** 本服务器是否提供"测试账套"(yinjia.enable-test-ledger,默认开)。见 factories() 注释。 */
    private final boolean testLedgerEnabled;

    public ShellController(PanelRegistry registry, JdbcTemplate jdbc, QrBatchService qrBatch,
                           DashboardStatsService dashboardStats, FlowBoardService flowBoard,
                           @org.springframework.beans.factory.annotation.Value("${yinjia.factory-name:YINJIA-MES}") String factoryName,
                           @org.springframework.beans.factory.annotation.Value("${yinjia.test-factory-name:YINJIA-MES·测试库}") String testFactoryName,
                           @org.springframework.beans.factory.annotation.Value("${yinjia.enable-test-ledger:true}") boolean testLedgerEnabled) {
        this.registry = registry;
        this.jdbc = jdbc;
        this.qrBatch = qrBatch;
        this.dashboardStats = dashboardStats;
        this.flowBoard = flowBoard;
        this.factoryName = factoryName;
        this.testFactoryName = testFactoryName;
        this.testLedgerEnabled = testLedgerEnabled;
    }

    /**
     * 登录页「登录工厂」下拉(ADR-0003 一系统两账套):正式 YJ + 测试 YJ_TEST。
     * 显示名取配置(yinjia.factory-name / test-factory-name),与顶栏一致。
     * ⚠ 这里返回的 code 会随登录请求回传,后端据此决定这次登录查哪个库、并写进令牌声明 ——
     * 两个 code 必须与 DataSourceRouter.PROD / TEST 一致,改名要一起改。
     *
     * yinjia.enable-test-ledger=false(2026-09-22b 补):只返回正式账套 —— 服务器上并没有
     * HSDZ_MES_TEST 这个库(两账套只在开发机),菜单里挂着"点了就 500 的选项"纯属坑人;
     * 关掉后登录页与顶栏切换菜单都不再出现测试库。服务器打开方式见 deploy/部署说明.md §A4。
     */
    @GetMapping("/base/factory/list")
    public ApiResult<List<Map<String, Object>>> factories() {
        List<Map<String, Object>> list = new ArrayList<>();
        Map<String, Object> prod = new HashMap<>();
        prod.put("code", DataSourceRouter.PROD);
        prod.put("name", factoryName);
        list.add(prod);
        if (testLedgerEnabled) {
            Map<String, Object> test = new HashMap<>();
            test.put("code", DataSourceRouter.TEST);
            test.put("name", testFactoryName);
            list.add(test);
        }
        return ApiResult.ok(list);
    }

    /** 仓库下拉:引用基础档案·仓库面板明细(bs_wh,按仓库编码绑定,字典改名不影响);
     *  仅列启用且未停用的仓库 */
    @GetMapping("/base/warehouse/list")
    public ApiResult<List<Map<String, Object>>> warehouses() {
        return ApiResult.ok(jdbc.query(
                "SELECT [仓库编码] AS code, [仓库名称] AS name FROM bs_wh"
                        + " WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL([停用],0) <> 1 AND [状态] = N'启用' ORDER BY id",
                (rs, i) -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("code", rs.getString("code"));
                    m.put("name", rs.getString("name"));
                    return m;
                }));
    }

    /** 我的桌面·研发管理:修改申请动态(待审批) + 各文件面板最新单据 + 档案本面板清单(2026-10-16 起支持区间) */
    @GetMapping("/dashboard/rd")
    public ApiResult<Map<String, Object>> rdBoard(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        DashboardStatsService.Range range = DashboardStatsService.Range.of(from, to);
        String f = range.fromStr(), t = range.toExclusive();
        Map<String, Object> out = new HashMap<>();
        List<Map<String, Object>> mods = new ArrayList<>();
        try {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT TOP 20 panel_code, doc_no, modify_req_by, modify_req_at FROM yj_doc_status"
                            + " WHERE ISNULL(modify_state,'') = 'R' AND ISNULL(canceled,'N') <> 'Y'"
                            + " AND modify_req_at >= ? AND modify_req_at < ? ORDER BY modify_req_at DESC", f, t)) {
                Map<String, Object> m = new HashMap<>();
                m.put("panelCode", r.get("panel_code"));
                m.put("panelName", panelNameOf(String.valueOf(r.get("panel_code"))));
                m.put("docNo", r.get("doc_no"));
                m.put("by", r.get("modify_req_by"));
                m.put("at", r.get("modify_req_at"));
                mods.add(m);
            }
        } catch (Exception ignored) {
        }
        List<Map<String, Object>> newDocs = new ArrayList<>();
        List<Map<String, Object>> panels = new ArrayList<>();
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (!ButtonService.DOC_ARCHIVE_PANELS.contains(def.code()) || !def.hasHeadTable()) continue;
            Map<String, Object> p = new HashMap<>();
            p.put("code", def.code());
            p.put("name", def.name());
            panels.add(p);
            try {
                newDocs.addAll(jdbc.queryForList(
                        "SELECT TOP 5 '" + def.code() + "' AS panelCode, N'" + def.name().replace("'", "''") + "' AS panelName"
                                + ", t.[" + def.groupCol() + "] AS docNo, t.asp_user1 AS creator, t.asp_time1 AS at"
                                + " FROM " + def.headTable() + " t WHERE ISNULL(t.asp_cancel,'N') <> 'Y'"
                                + " AND t.asp_time1 >= ? AND t.asp_time1 < ? ORDER BY t.asp_time1 DESC", f, t));
            } catch (Exception ignored) {
            }
        }
        newDocs.sort((a, b) -> String.valueOf(b.get("at")).compareTo(String.valueOf(a.get("at"))));
        out.put("modifyRequests", mods);
        out.put("newDocs", newDocs.size() > 20 ? newDocs.subList(0, 20) : newDocs);
        out.put("panels", panels);
        return ApiResult.ok(out);
    }

    /*
     * ── 我的桌面·模块「单据入口」(2026-10-18 用户口径:「研发/生产/质量/库存/销售 这几个模块
     *    加上一个单据入口,可以通过点击单据入口跳转对应单据面板,就显示最新的 7 张单据」)──
     *
     * 口径(为什么这么取):
     *  1. 单据面板 = yj_panel.mode='doc' 且有 head_table —— 与 /dashboard/rd 的「最新单据」同一类,
     *     但不复用 ButtonService.DOC_ARCHIVE_PANELS:那个集合是**研发文书归档**登记表(RD_*),
     *     库存/生产/品质的单据根本不入册,拿它筛会一张都出不来。
     *  2. 模块归属 = yj_panel.module_group(研发管理/生产制造/库存管理/品质管理 恰好与桌面五个
     *     模块一一对应);**销售模块例外**:「智能供应链」这组把 采购单(CGD)/采购订单(PU_ORDER)
     *     与 销售订单(SO_ORDER)/客户订单(KHDD) 混在一起,按分组取会把采购单混进销售桌面
     *     ⇒ 销售显式点名这两张面板。销售出库单(SALE_OUT)归「库存管理」,不在此列。
     *  3. 按当前用户可见面板过滤(管理员 = *,普通用户 = 角色勾了 view 的面板)—— 桌面别当越权入口。
     *  4. 每面板取 TOP n 再合并排序取 n 条:某一张面板刷得勤也不会把其它面板挤没。
     */
    /** 模块键 → yj_panel.module_group */
    private static final Map<String, String> MODULE_GROUP = Map.of(
            "rd", "研发管理", "prod", "生产制造", "stock", "库存管理", "quality", "品质管理");
    /** 模块键 → 显式面板码(见上面第 2 条:分组混装的模块只能点名) */
    private static final Map<String, List<String>> MODULE_PANELS = Map.of(
            "sales", List.of("SO_ORDER", "KHDD"));

    /** 桌面模块「单据入口」:该模块单据面板最近 N 张单据 + 面板清单
     *  @param panel 可选面板码(2026-10-18 用户口径「加上可选面板,筛选的是对应面板的最新的 7 张数据」):
     *               空 = 本模块全部单据面板汇总;非空 = 只出该面板的最近 N 张。
     *               ⚠ panels 清单**不随 panel 收窄** —— 前端下拉要一直能列出本模块全部单据面板,
     *               否则选了第一张后面板选项就没了。 */
    @GetMapping("/dashboard/module-docs")
    public ApiResult<Map<String, Object>> moduleDocs(@RequestParam String module,
                                                     @RequestParam(defaultValue = "7") int limit,
                                                     @RequestParam(required = false) String panel) {
        String mod = module == null ? "" : module.trim();
        List<String> pinned = MODULE_PANELS.get(mod);
        String group = MODULE_GROUP.get(mod);
        if (pinned == null && group == null) throw new IllegalArgumentException("未知模块:" + module);
        int n = Math.max(1, Math.min(limit, 50));
        List<String> visible = currentVisiblePanels();
        boolean all = visible.contains("*");
        List<Map<String, Object>> panels = new ArrayList<>();
        List<Map<String, Object>> docs = new ArrayList<>();
        for (PanelRegistry.PanelDef def : registry.all()) {
            if (!def.isDoc() || !def.hasHeadTable()) continue;
            if (pinned != null ? !pinned.contains(def.code()) : !group.equals(def.moduleName())) continue;
            if (!all && !visible.contains(def.code())) continue;
            String docCol = def.groupCol();
            String head = def.headTable();
            // 表名/列名来自元数据,照样做一次白名单校验:拼进 SQL 的标识符不接受别的字符。
            // ⚠ 必须放行中文字段名:本项目 group_col 绝大多数就是中文列(单据编号/合同号/报工单号…),
            //   早期只写 [A-Za-z0-9_] 会把四组单据面板全被 continue 掉(2026-10-18 实测:库存/生产/
            //   品质/研发 全 0 条,只有 group_col 恰为英文 od_no 的客户订单出得来)。
            if (docCol == null || docCol.isBlank() || head == null || !head.matches("[\\p{L}\\p{N}_]+")
                    || !docCol.matches("[\\p{L}\\p{N}_]+")) {
                continue;
            }
            Map<String, Object> p = new HashMap<>();
            p.put("code", def.code());
            p.put("name", def.name());
            panels.add(p);
            // 面板筛选只作用于单据列表(见方法头:panels 必须保持全量)
            if (panel != null && !panel.isBlank() && !panel.trim().equals(def.code())) continue;
            try {
                for (Map<String, Object> r : jdbc.queryForList(
                        "SELECT TOP " + n + " t.[" + docCol + "] AS docNo, t.asp_user1 AS creator, t.asp_time1 AS at"
                                + " FROM " + head + " t WHERE ISNULL(t.asp_cancel,'N') <> 'Y'"
                                + " AND t.asp_time1 IS NOT NULL ORDER BY t.asp_time1 DESC")) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("panelCode", def.code());
                    m.put("panelName", def.name());
                    m.put("docNo", r.get("docNo"));
                    m.put("creator", r.get("creator"));
                    m.put("at", r.get("at"));
                    docs.add(m);
                }
            } catch (Exception ignored) {
                // 单面板查询失败(表缺列/结构陈旧)不影响其它面板
            }
        }
        docs.sort((a, b) -> String.valueOf(b.get("at")).compareTo(String.valueOf(a.get("at"))));
        Map<String, Object> out = new HashMap<>();
        out.put("module", mod);
        out.put("panels", panels);
        out.put("docs", docs.size() > n ? new ArrayList<>(docs.subList(0, n)) : docs);
        return ApiResult.ok(out);
    }

    /** 当前用户可见面板:管理员 = *,普通用户 = 角色勾了 view 的面板(与 PortalNotificationService 同口径) */
    private List<String> currentVisiblePanels() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String user = auth == null ? null : auth.getName();
        if (user == null) return List.of();
        try {
            List<Integer> admin = jdbc.query(
                    "SELECT CASE WHEN is_admin = 'Y' THEN 1 ELSE 0 END FROM yj_user WHERE username = ?",
                    (rs, i) -> rs.getInt(1), user);
            if (!admin.isEmpty() && admin.get(0) == 1) return List.of("*");
            return jdbc.query(
                    "SELECT rp.panel_code FROM yj_role_panel rp JOIN yj_user u ON u.role_id = rp.role_id"
                            + " WHERE u.username = ? AND rp.perms LIKE '%view%'",
                    (rs, i) -> rs.getString(1), user);
        } catch (Exception e) {
            return List.of();
        }
    }

    private String panelNameOf(String code) {
        try {
            PanelRegistry.PanelDef d = registry.panel(code);
            return d == null ? code : d.name();
        } catch (Exception e) {
            return code;
        }
    }

    // ============ 二维码批号 ============

    /** 生成新批号(yyyymmdd+3位流水) */
    @GetMapping("/qr/next-batch")
    public ApiResult<String> nextBatch(@RequestParam String itemType, @RequestParam String sourceNo,
                                        @RequestParam(required = false, defaultValue = "MANUAL") String sourceType) {
        return ApiResult.ok(qrBatch.nextBatchNo(itemType, sourceType, sourceNo, "system"));
    }

    /** 按来源查批号列表 */
    @GetMapping("/qr/by-source")
    public ApiResult<List<java.util.Map<String, Object>>> qrBySource(@RequestParam String sourceType, @RequestParam String sourceNo) {
        return ApiResult.ok(qrBatch.findBySource(sourceType, sourceNo));
    }

    /** 按日期查批号(打印界面) */
    @GetMapping("/qr/by-date")
    public ApiResult<List<java.util.Map<String, Object>>> qrByDate(@RequestParam String from, @RequestParam String to) {
        return ApiResult.ok(qrBatch.findByDateRange(from, to));
    }

    @GetMapping("/sys/menu/tree")
    public ApiResult<List<Map<String, Object>>> menuTree() {
        return ApiResult.ok(List.of());
    }

    @GetMapping("/dashboard/stats")
    public ApiResult<Map<String, Object>> dashboard(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        // 2026-09-28 聚合下沉 DashboardStatsService(代码规范 A2:SQL 只在 service);
        // 各模块图表数据(生产/库存/销售/质量/研发)由 service 一次返回,Controller 只转发。
        // 2026-10-16:加时间区间 from/to(yyyy-MM-dd,闭区间;缺省=近 30 天),各模块单据口径按区间过滤。
        return ApiResult.ok(dashboardStats.stats(from, to));
    }

    /**
     * 产能对比(2026-10-08):桌面「产能对比」卡片按产线做竖向双柱(实际 vs 上限)。
     * 单独一个端点而不是塞进 /dashboard/stats —— 切 tab 只重算这一块,
     * 不用把整桌面的 KPI/库存/研发聚合全部重跑一遍。
     *
     * @param period day|week|month|year(缺省/非法值按 day 处理,见 DashboardStatsService.capacity)
     */
    @GetMapping("/dashboard/capacity")
    public ApiResult<Map<String, Object>> dashboardCapacity(
            @RequestParam(name = "period", defaultValue = "day") String period) {
        return ApiResult.ok(dashboardStats.capacity(period));
    }

    /**
     * 流程管控(2026-10-16):桌面新页签「流程管控」的**节点口径数据** ——
     * 生产链(销售订单→结转→工单→排产→报工→检验→产成品入库)与
     * 库存链(采购订单→暂收→来料检验/特采/退货→采购入库)每个节点当前有几张单、卡在哪一步。
     *
     * <p>图形与链路排布不走服务端:前端 {@code views/dashboard/flowSpec.js} 的声明式规格决定,
     * 本端点只保证"数准"且与既有服务同口径(见 {@link com.yinjia.mes.service.FlowBoardService})。
     */
    @GetMapping("/dashboard/flow")
    public ApiResult<Map<String, Object>> dashboardFlow() {
        return ApiResult.ok(flowBoard.flow());
    }
}
