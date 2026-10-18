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
     * ERP 集成配置清单:只有「看」和「改配置」两件事。
     * 配置保存写的是接口/映射/设备绑定三张配置表(全公司共用一份),故单列 save 词,
     * 不借用 add/modify(那两个词在单据面板上表示"新增/申请修改单据",语义不同)。
     */
    private static final String[][] ERP_INTEG_ACTIONS = {
            {"view", "可见"},
            {"save", "配置保存"},
    };

    /** 全部页面面板(顺序 = 矩阵内展示顺序;模块名与 {@code ReportService.NAV_GROUP_ORDER} 一致) */
    public static final List<PagePanelDef> ALL = List.of(
            new PagePanelDef(ORDER_CONVERT, "订单结转", "生产制造", ORDER_CONVERT_ACTIONS),
            new PagePanelDef(SCHEDULE_BOARD, "快速排产", "生产制造", SCHEDULE_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_BOARD, "工单排产", "生产制造", WORK_ORDER_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_LIST, "生产工单", "生产制造", WORK_ORDER_LIST_ACTIONS),
            new PagePanelDef(ERP_INTEG, "ERP集成配置清单", "ERP系统集成", ERP_INTEG_ACTIONS));

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
