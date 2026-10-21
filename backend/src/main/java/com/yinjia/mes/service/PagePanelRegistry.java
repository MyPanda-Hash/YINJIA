package com.yinjia.mes.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 页面级虚拟面板注册表(2026-10-16)。
 *
 * <p>背景:订单结转 / 快速排产 / 工单排产 三个看板页面**没有 yj_panel 行**(它们不是单据面板,
 * 数据来自 plang、plang_pc、bl_so_order 等既有表),而组织架构 →「角色与面板权限」矩阵
 * ({@code SysAdminController.rolePanels})只列 {@code PanelRegistry.all()} = yj_panel 的面板
 * ⇒ 这三个页面**在权限界面里根本没得勾**;生产工单列表页同样没挂面板码。
 * 后果:四条菜单项在 {@code menus.js} 里没有 panelCode,而 {@code filterMenuTree} 对
 * 「无 panelCode 的叶子」一律放行 ⇒ 任何登录账号都能看到并进入这四个页面;
 * 后端只是"借" SO_ORDER / MANU_ORDER 的权限当闸门,且 {@code /px/workOrderList} 列表接口
 * 此前**完全没有校验**(登录即可读全部工单/客户/数量)。
 *
 * <p>做法沿用既有先例「虚拟面板 DASHBOARD(我的桌面)」:
 * <ul>
 *   <li>**不往 yj_panel 插行** —— 空面板(无表、无字段)会污染报表/选单/字段配置等
 *       {@code registry.all()} 的下游;</li>
 *   <li>矩阵条目由 {@code SysAdminController} 直接注入,授权照旧落 {@code yj_role_panel}
 *       (该表无外键,按 panel_code 存字符串);</li>
 *   <li>服务端闸门 = {@link PanelPermissionService#requirePanelView}/{@code requireButton},
 *       按本表的 perms 词表判定(与真实面板同一套机制)。</li>
 * </ul>
 *
 * <p>动作集**按页面特性裁剪**(用户口径 2026-10-16「针对当前页面的特性进行编写实现」):
 * 只出该页真实存在的动作,不套用通用 12 项 —— 否则会出现「审核」「调价」这类页面上根本没有的格子。
 */
public final class PagePanelRegistry {

    /** 页面面板定义:编码 / 中文名(与菜单标题一致,译名走 yj_translation 与前端 i18n)/ 导航一级模块 / 动作集 */
    public record PagePanelDef(String code, String name, String module, String[][] actions) { }

    /** 订单结转·发单工作台:待结转行 → 转工单;交期可就地改;全部只读查询 */
    public static final String ORDER_CONVERT = "ORDER_CONVERT";
    /** 快速排产:待排产池 → 排入产线(含工序路线排线)/ 撤销排产回池 */
    public static final String SCHEDULE_BOARD = "SCHEDULE_BOARD";
    /** 工单排产:产线骨架看板 → 调拨/撤回调拨/取消结案/打印生产任务单 */
    public static final String WORK_ORDER_BOARD = "WORK_ORDER_BOARD";
    /** 生产工单(列表页):工单查询 + 结案/切单/转领料单/打印/导出,并可原地弹出快速排产排入 */
    public static final String WORK_ORDER_LIST = "WORK_ORDER_LIST";
    /**
     * ERP 集成配置清单(2026-10-18):导入 / 转出两向 × 分类的接口、设备、字段映射统一配置页。
     * 数据源是三张配置表(erp_integ_api / _field / _device),**不是** yj_panel 单据面板,
     * 故同样按页面级虚拟面板登记 —— 授权落 yj_role_panel,页面菜单按 panelCode 显隐。
     * 动作只有两个:view(看配置)+ save(改配置);本页不含单据动作。
     */
    public static final String ERP_INTEG = "ERP_INTEG";
    /** 数采平台·设备配置管理(2026-10-20) */
    public static final String DC_CONFIG = "DC_CONFIG";
    /** 数采平台·数据监控(2026-10-20) */
    public static final String DC_MONITOR = "DC_MONITOR";
    /** 数采平台·状态统计(2026-10-20) */
    public static final String DC_STATS = "DC_STATS";
    /** 库存管理(现 WMS管理系统)·条码管理 → 扫码领料(2026-10-20) */
    public static final String BARCODE_SCAN_PICK = "BARCODE_SCAN_PICK";
    /**
     * 生产计划 → 生产领料(2026-10-20,用户口径「把他写成面版,这样我也可以选择在电脑端操作,
     * 名字叫生产领料在生产计划里面」)。
     *
     * <p>与 {@link #BARCODE_SCAN_PICK} 的关系:那条是「扫标签(存货编码|批号)按批号领料」的**仓管视角**;
     * 这条是**车间/生管视角**:先扫工单(带出产品/产线/排产数量),再逐件扫原材料、按
     * 「批号日期先进先出」自动拆批,一次生成一张材料出库单草稿(带 加工单号+工单行号)。
     * 同一份页面代码(`MobilePick.vue`)两端共用:手机走 `/m/pick`(独立布局),电脑走
     * `/prod/plan/prodPick`(桌面壳内,双栏)。数据侧仍走通用面板引擎 + 审核过账,**没有新表**。
     */
    public static final String PROD_PICK = "PROD_PICK";
    /** 工序报工(2026-10-21):页面级虚拟面板,扫工单码报工 */
    public static final String PROD_REPORT = "PROD_REPORT";

    private static final String[][] ORDER_CONVERT_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询"},
            {"date",    "修改交期"},
            {"convert", "转工单"},
    };

    private static final String[][] SCHEDULE_BOARD_ACTIONS = {
            {"view",     "可见"},
            {"query",    "查询"},
            {"assign",   "排产"},
            {"unassign", "撤销排产"},
    };

    private static final String[][] WORK_ORDER_BOARD_ACTIONS = {
            {"view",     "可见"},
            {"query",    "查询"},
            {"transfer", "调拨"},
            {"revoke",   "撤回调拨"},
            {"unclose",  "取消结案"},
            {"print",    "打印"},
    };

    private static final String[][] WORK_ORDER_LIST_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询"},
            {"print",   "打印"},
            {"close",   "结案"},
            {"split",   "切单"},
            {"picking", "转领料单"},
            {"recipe",  "获取混料配方"},
            {"export",  "导出"},
            {"assign",  "排产"},
    };

    /**
     * ERP 集成配置清单:只有「可见」一个授权词。
     *
     * <p>2026-10-18 用户口径「保证这个面板除管理员只可看不可编辑」——
     * **写配置不再走权限词**(矩阵里也不再给非管理员任何写格子),
     * 而是由 {@code ErpIntegController} 直接 {@code perm.requireAdmin()}:管理员恒可改,
     * 非管理员即使被授权"可见"也只能看,连 save 词都授不出去。
     */
    private static final String[][] ERP_INTEG_ACTIONS = {
            {"view", "可见"},
    };

    /**
     * 数采平台三页(2026-10-20):设备配置管理 / 数据监控 / 状态统计 —— Vue 页面,数据来自
     * bs_dc_* 七张表,不是 yj_panel 单据面板。此前**没有面板码** ⇒ 权限矩阵里勾不到、任何登录账号都能进。
     * 动作按页面真实能力给:配置页只有「看」(写操作由后端 requireAdmin 硬闸),监控页可处理报警,统计页只读。
     */
    private static final String[][] DC_CONFIG_ACTIONS = {
            {"view", "可见"},
            {"query", "查询"},
    };

    private static final String[][] DC_MONITOR_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
            {"alarm", "处理报警"},
    };

    private static final String[][] DC_STATS_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
    };

    /**
     * 扫码领料(2026-10-20):扫标签码 `存货编码|批号` → 组材料出库单草稿。
     * 数据侧走通用面板引擎(STOCK_PICK 选货 + MATERIAL_OUT 生单),服务端闸门本来就在 MATERIAL_OUT 上;
     * 这里登记的只是**页面本身**的可见/查询权,让它在「角色与面板权限」里能勾。
     */
    private static final String[][] BARCODE_SCAN_PICK_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
            {"pick",  "生成领料单"},
    };

    /**
     * 生产领料(2026-10-20):扫工单 → 逐件扫原材料 → 先进先出拆批 → 生成材料出库单草稿。
     * 页面自身只需 可见/查询/生成领料单;真正的写入与过账仍受 MATERIAL_OUT 面板权限约束。
     */
    private static final String[][] PROD_PICK_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
            {"pick",  "生成领料单"},
    };

    /**
     * 工序报工(2026-10-21):扫工单 → 选工序(成型/切炭/组装)→ 填数量 → 提交。
     * 提交走 WO_REPORT 报工单(保存+审核),工序进度/当前工序由既有审核钩子推进。
     * 页面自身只需 可见/查询/报工;真正的记账仍受 WO_REPORT 面板权限约束。
     */
    private static final String[][] PROD_REPORT_ACTIONS = {
            {"view",   "可见"},
            {"query",  "查询"},
            {"report", "报工"},
    };

    /** 全部页面面板(顺序 = 矩阵内展示顺序;模块名与 {@code ReportService.NAV_GROUP_ORDER} 一致) */
    public static final List<PagePanelDef> ALL = List.of(
            // 2026-10-20 导航改版:「生产制造」一级目录拆掉,这四个看板所属分组合并为「生产计划」
            //   (与 menus.js 的 top-level「生产计划」/「生产过程」对应,权限矩阵按此分组)
            new PagePanelDef(ORDER_CONVERT, "订单结转", "生产计划", ORDER_CONVERT_ACTIONS),
            new PagePanelDef(SCHEDULE_BOARD, "快速排产", "生产计划", SCHEDULE_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_BOARD, "工单排产", "生产计划", WORK_ORDER_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_LIST, "生产工单", "生产计划", WORK_ORDER_LIST_ACTIONS),
            // 2026-10-20 用户口径「把他写成面版,这样我也可以选择在电脑端操作,名字叫生产领料在生产计划里面」
            new PagePanelDef(PROD_PICK, "生产领料", "生产计划", PROD_PICK_ACTIONS),
            // 2026-10-21 用户口径「再写一个工序报工的面版」(与生产领料同组、同形态)
            new PagePanelDef(PROD_REPORT, "工序报工", "生产计划", PROD_REPORT_ACTIONS),
            new PagePanelDef(ERP_INTEG, "ERP集成配置清单", "ERP系统集成", ERP_INTEG_ACTIONS),
            // 2026-10-20 补登:数采平台三页 + 扫码领料(此前菜单里无面板码 ⇒ 矩阵里缺这几个)
            new PagePanelDef(DC_CONFIG, "设备配置管理", "数采平台", DC_CONFIG_ACTIONS),
            new PagePanelDef(DC_MONITOR, "数据监控", "数采平台", DC_MONITOR_ACTIONS),
            new PagePanelDef(DC_STATS, "状态统计", "数采平台", DC_STATS_ACTIONS),
            new PagePanelDef(BARCODE_SCAN_PICK, "扫码领料", "WMS管理系统", BARCODE_SCAN_PICK_ACTIONS));

    private static final Map<String, PagePanelDef> BY_CODE = buildIndex();

    private PagePanelRegistry() { }

    private static Map<String, PagePanelDef> buildIndex() {
        Map<String, PagePanelDef> m = new LinkedHashMap<>();
        for (PagePanelDef d : ALL) m.put(d.code(), d);
        return Map.copyOf(m);
    }

    /** 按编码取定义;非页面面板返回 null */
    public static PagePanelDef byCode(String code) {
        return code == null ? null : BY_CODE.get(code.trim());
    }

    /** 是否页面级虚拟面板(前端 pagePerms 下发范围 = 本表) */
    public static boolean isPagePanel(String code) {
        return byCode(code) != null;
    }

    /** 全部页面面板编码(顺序同 {@link #ALL}) */
    public static List<String> codes() {
        return ALL.stream().map(PagePanelDef::code).toList();
    }
}
