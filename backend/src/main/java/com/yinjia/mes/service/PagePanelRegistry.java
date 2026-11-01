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
 * 后端原先只是"借" SO_ORDER / MANU_ORDER 的权限当闸门(2026-10-28 MANU_ORDER 已下架,生产域改挂本表页面码),且 {@code /px/workOrderList} 列表接口
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
    /** 数采平台·IOT设备配置(2026-10-20) */
    public static final String DC_CONFIG = "DC_CONFIG";
    /** 数采平台·数据监控(2026-10-20) */
    public static final String DC_MONITOR = "DC_MONITOR";
    /** 数采平台·状态统计(2026-10-20) */
    public static final String DC_STATS = "DC_STATS";
    /** 库存管理(现 WMS管理)·条码管理 → 扫码领料(2026-10-20) */
    public static final String BARCODE_SCAN_PICK = "BARCODE_SCAN_PICK";
    /**
     * 生产计划 → 生产领料(2026-10-20,用户口径「把他写成面版,这样我也可以选择在电脑端操作,
     * 名字叫生产领料在生产计划里面」)。
     *
     * <p>⚠ 2026-10-30:已迁到新一级目录「手机扫码」并改名 {@link #MOBILE_PICK}(重写)。
     * 本常量保留为**兼容别名** —— 既有 {@code yj_role_panel} 授权行、{@code yj_translation} 译名
     * 与老客户端都还按这个码来,不能直接删;{@link #byCode} 对别名回落到新定义,故权限矩阵里
     * 这行授权仍然有效,只是显示在新分组下。
     */
    public static final String PROD_PICK = "PROD_PICK";
    /**
     * 工序报工(2026-10-21):页面级虚拟面板,扫工单码报工。
     *
     * <p>⚠ 2026-10-30:已随「生产领料」一并迁到「手机扫码」一级目录,改名 {@link #MOBILE_REPORT}
     * (页面逻辑一行未改)。本常量同样保留为兼容别名。
     */
    public static final String PROD_REPORT = "PROD_REPORT";

    /**
     * 手机扫码 · 生产领料(2026-10-30 重写)。
     *
     * <p>用户口径:「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』
     * (和生产计划平级)导航下。工序报工不变。生产领料重写。」
     *
     * <p>作业链路(与 2026-10-20 旧版的区别:旧版一次扫到底直接生成材料出库单草稿;
     * 新版拆成「生单 → 领料 → 提交」三段,单子本身是车间可查可续领的凭据):
     * <ol>
     *   <li><b>生成工单领料/退料单</b> —— 扫工单码,按该工单行的产品的《组装BOM表》
     *       ({@code rd_asm_bom_head} → {@code rd_asm_bom_detail} 的 物料编号/用量)展开用料,
     *       同时生成**一张领料单 + 一张退料单**草稿(数量全 0),并自动打印一次工单二维码;</li>
     *   <li><b>生产领料(列表)</b> —— 未完成 / 已完成两组,可展开收起;扫码框直接定位单据;</li>
     *   <li><b>单据详情</b> —— 逐项扫物料码解锁数量(批次沿用既有先进先出逻辑),**
     *       全部行都领到数量才可以提交**,提交走材料出库单审核过账;退料默认 0、不操作即整单作废。</li>
     * </ol>
     *
     * <p>配对台账 = {@code wo_pick_doc}(工单号+行号唯一),见
     * {@code tools/migrate-wo-pick-doc-20261030.sql}。
     */
    public static final String MOBILE_PICK = "MOBILE_PICK";

    /**
     * 手机扫码 · 生成工单领料/退料单(2026-10-30,**独立面板**,与 {@link #MOBILE_PICK} 分工)。
     *
     * <p>用户口径(2026-10-30 第二轮纠正):「还有少了一个『生成工单领料/退料单』这个面版,
     *   这个面版的功能和生成领料是有区别的(不是一个面版),重新分析需求」,
     *   三问确认:① 定位 = **电脑上的开单工作台**(可扫多张工单**批量生成**、列表看已生成的单);
     *   ② 职责 = **只管生单**,生完引导到「生产领料」去领;③ 菜单顺序 = 本面板排在「生产领料」**之前**。
     *
     * <p>为什么必须独立成一个面板(而不是塞在领料列表页顶部):
     * <ul>
     *   <li>**岗位与地点不同**:开单是生管/计划员在办公室用电脑批量开;领料是车间在手机上逐项扫。
     *       混在一页,两个岗位谁都不好用;</li>
     *   <li>**批量 vs 单张**:开单工作台要能一次扫多张工单连续生成(现场把一沓工单码挨个扫过去),
     *       领料页只需要"进到某一对单据里干活"。</li>
     * </ul>
     *
     * <p>本面板**复用** {@link #MOBILE_PICK} 同一套生单逻辑(一个工单行 ⇒ 一对领料/退料单),
     * 不重复实现 BOM 展开与单据生成 —— 两个面板只是"入口不同、职责不同"。
     *
     * <p>动作:view(可见) + query(查已生成列表) + create(生单) + print(生单后自动打二维码)。
     */
    public static final String MOBILE_PICK_CREATE = "MOBILE_PICK_CREATE";

    /**
     * 手机扫码 · 工序报工(2026-10-30 从「生产计划」迁入;页面逻辑与 2026-10-21 版**完全一致**,
     * 只换了地址 {@code /panelx/list/MOBILE_REPORT} 与面板码)。
     * 提交走 {@code WO_REPORT} 报工单(保存+审核),工序进度/当前工序由既有审核钩子推进。
     */
    public static final String MOBILE_REPORT = "MOBILE_REPORT";

    /**
     * 手机扫码 · 自动打印(2026-10-30)。
     *
     * <p>用户口径:「(打印)要单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数
     * 并且设置成打开,然后在手机打印的时候就可以关联这个打开了面版参数的电脑,
     * 这台电脑连接的打印机就会自动打印」。
     *
     * <p>形态:**电脑上打开的一页**,选打印机 + 打开「自动打印」开关后页面常驻轮询打印队列,
     * 收到手机端发来的工单二维码就静默出纸。所以它是一张**页面级虚拟面板**,数据不进库
     * (配置按浏览器 localStorage 绑本机 —— 每台电脑设置自己那台打印机,一个账号可能登录多台电脑,
     * **不能**按登录账号存)。
     *
     * <p>真正的静默出纸靠本地打印代理(见 {@code tools/printing/print-agent.ps1}):
     * 浏览器标准 {@code window.print()} 一定会弹对话框,只有代理调系统打印才能零点击。
     */
    public static final String PRINT_STATION = "PRINT_STATION";
    /**
     * 供应商采购打印(2026-10-24,用户口径「采购管理里面多增加俩个面版,一个是供应商采购打印面版…
     * 供应商可以通过这个面版来查看和打印数据。没有别的权限」)。
     *
     * <p>供应商登录后**唯一**能打开的页面:只读列表(bd_pu_order 头行,服务端强制
     * {@code 供应商编码 = 当前供应商}) + 银嘉采购订单纸质单打印。
     * 数据接口在 {@code /api/supplier/portal/*}({@link SupplierPortalService}),
     * 真正的闸门是 {@code SupplierPortalGuardFilter}(供应商会话的 /api 请求只放行这几条)。
     *
     * <p>⚠ 2026-10-25:界面入口已改为**独立面板** {@code SUPPLIER_PU_ORDER}(采购订单的只读元数据副本,
     * 见 PanelAliases),本条保留只为兼容既有授权行与译名。
     */
    public static final String SUPPLIER_PRINT = "SUPPLIER_PRINT";
    /**
     * 供应商权限配置(2026-10-24):采购管理下维护"哪个供应商账号能登录、绑定哪个供应商编码"。
     * **管理员 ∪ 组织架构授权「配置供应商账号」的账号**(2026-10-25 起不再管理员专属)。
     */
    public static final String SUPPLIER_ACCOUNT = "SUPPLIER_ACCOUNT";
    /**
     * WMS管理·条码管理 → 工单扫码领料(2026-10-21,手机端)。
     * 扫工单码 → 按 BOM 列出该领的料 → 逐项扫物料码 → 自动抓台车电子秤数量 → 整单提交生成材料出库单。
     * 数据侧走既有面板(PLANG 查工单 / WLBOM 查 BOM / MATERIAL_OUT 生单),
     * 页面本身是 Vue ⇒ 按页面级虚拟面板登记,授权落 yj_role_panel。
     */
    public static final String WORK_ORDER_PICK = "WORK_ORDER_PICK";
    /**
     * 研发管理·项目管理 → 项目流程管控(2026-10-20 用户口径):
     * 按立项申请单号查这条项目在「立项申请 → 定级分发 → 责任人确认 → 实施计划 → 审批归档 → 进度查询」
     * 里走到哪一步、卡在谁手上。Vue 页面,数据现算(rd_approval/rd_plan/yj_doc_status/yj_form_approval),
     * **不是** yj_panel 单据面板 ⇒ 按页面级虚拟面板登记,授权落 yj_role_panel。
     */
    public static final String PROJECT_FLOW = "PROJECT_FLOW";
    /**
     * 工序流程追踪卡(2026-10-29,用户口述《新建 DOCX 文档 (2).docx》「生产相关」):
     * 日期大批次下挂小批次(一张卡=一个小批次=一个工单行),每道工序挂现场照片(电脑选图/手机拍照),
     * 卡的工序行**挂载到工序台账与已审核报工**(完成量/完成时间取 scjl 现算),按卡追溯。
     *
     * <p>数据 = {@code wo_proc_card_head} / {@code wo_proc_card_detail} + 照片复用 {@code yj_attachment};
     * 页面是专用 Vue(`views/modules/plan/ProcFlowCard.vue`),**不是 yj_panel 单据面板** ⇒
     * 按页面级虚拟面板登记:授权落 {@code yj_role_panel},菜单按 panelCode 显隐,后端闸门走本表动作词。
     * 动作集按页面真实能力裁剪(录入照片/确认完成是写动作;查询/列表/批次追溯只读)。
     */
    public static final String PROC_FLOW_CARD = "PROC_FLOW_CARD";

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
            // 2026-10-29:表格内「日排产」日期列(计划可填)—— 与生产工单页同一动作词
            {"dayplan",  "日排产"},
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
            // 2026-10-29:表格内「日排产」日期列(计划可填)—— 与工单排产页同一动作词
            {"dayplan", "日排产"},
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
     * 数采平台三页(2026-10-20):IOT设备配置 / 数据监控 / 状态统计 —— Vue 页面,数据来自
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
     * 手机扫码 · 生产领料(2026-10-30 重写):扫工单生单 → 逐项扫码核销 → 提交转材料出库单。
     *
     * <p>动作按页面真实能力给:
     * <ul>
     *   <li>{@code view}   —— 能看到这个菜单与列表;</li>
     *   <li>{@code query}  —— 列表查询 + 打开单据详情;</li>
     *   <li>{@code create} —— 生成工单领料/退料单(扫工单开单);</li>
     *   <li>{@code pick}   —— 单据里扫物料码核销数量;</li>
     *   <li>{@code submit} —— 全部领完提交转材料出库单(会真正过账、动库存);</li>
     *   <li>{@code print}  —— 打/重打工单二维码。</li>
     * </ul>
     * ⚠ {@code submit} 是这一页**唯一动库存**的词 —— 真正的写入与过账仍受 MATERIAL_OUT 面板权限约束
     * (审核钩子那条链不变),本词只是页面入口的显隐与二道闸。
     */
    private static final String[][] MOBILE_PICK_ACTIONS = {
            {"view",   "可见"},
            {"query",  "查询"},
            {"create", "生成领料/退料单"},
            {"pick",   "扫码核销"},
            {"submit", "提交转材料出库单"},
            {"print",  "打印"},
    };

    /**
     * 生成工单领料/退料单(2026-10-30,独立开单工作台)。
     *
     * <p>动作集刻意**只到 create 为止**:这一页不开单后的核销与过账,
     * 那些都在 {@link #MOBILE_PICK} 上。这样权限可以分岗:计划员给 create、车间给 pick/submit。
     */
    private static final String[][] MOBILE_PICK_CREATE_ACTIONS = {
            {"view",   "可见"},
            {"query",  "查询"},
            {"create", "生成领料/退料单"},
            {"print",  "打印工单二维码"},
    };

    /**
     * 手机扫码 · 工序报工(2026-10-21 原动作集,随页面一起搬到新目录):
     * 扫工单 → 选工序(成型/切炭/组装)→ 填数量 → 提交。
     * 提交走 WO_REPORT 报工单(保存+审核),工序进度/当前工序由既有审核钩子推进。
     */
    private static final String[][] PROD_REPORT_ACTIONS = {
            {"view",   "可见"},
            {"query",  "查询"},
            {"report", "报工"},
    };

    /**
     * 手机扫码 · 自动打印站点(2026-10-30):电脑上打开的一页。
     * 动作 = 可见 + 配置(选打印机/开关自动打印/测试打印)。
     * 只有「配置」一个写词 —— 这一页**不碰任何业务单据数据**,只改本机的打印机设置与轮询开关。
     */
    private static final String[][] PRINT_STATION_ACTIONS = {
            {"view",   "可见"},
            {"config", "配置打印机"},
    };
    /**
     * 工单扫码领料(2026-10-21,手机端):扫工单码 → 按 BOM 列出该领的料 → 逐项扫物料码
     * → 自动抓台车电子秤数量 → 整单提交生成材料出库单。
     *
     * <p>数据侧全部走既有面板引擎:工单查 {@code PLANG}、BOM 查 {@code WLBOM}(mate)、
     * 生单走 {@code MATERIAL_OUT};秤值取数采平台 {@code /api/dc/monitor}。
     * 这里登记的只是**页面本身**的可见/查询/生单权,让它在「角色与面板权限」里能勾 ——
     * 与 {@link #BARCODE_SCAN_PICK} 同一套做法。
     *
     * <p>与「扫码领料」的区别:那张按**物料**找库存(扫到哪领到哪),这张按**工单**找用料
     * (先知道该领哪些、再逐项核销),作业口径不同故并列两个入口。
     */
    private static final String[][] WORK_ORDER_PICK_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
            {"pick",  "生成领料单"},
    };

    /**
     * 工序报工(2026-10-21):扫工单 → 选工序(成型/切炭/组装)→ 填数量 → 提交。
     * 提交走 WO_REPORT 报工单(保存+审核),工序进度/当前工序由既有审核钩子推进。
     * 页面自身只需 可见/查询/报工;真正的记账仍受 WO_REPORT 面板权限约束。
     *
     * <p>2026-10-30:定义已上移到 {@code PROD_REPORT_ACTIONS}(紧邻 MOBILE_REPORT),
     * 此处不再重复声明 —— 同名字段重复声明会编译不过。
     */

    /** 供应商采购打印:只有看与打,连"导出"都不给(用户口径「没有别的权限」) */
    private static final String[][] SUPPLIER_PRINT_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
            {"print", "打印"},
    };

    /**
     * 供应商权限配置(2026-10-24;2026-10-25 用户口径「不只是管理员可以来配置,需要能够通过组织架构
     * 添加可以配置的账号」)。
     *
     * <p>动作集 = 「配置供应商账号」这一个词(supplier):
     * <ul>
     *   <li>组织架构 →「角色与面板权限」勾上它,该角色下的账号就能进本页维护供应商账号
     *       (与「自定义字段」field、「预警配置」warn 同一套机制:词落 yj_role_panel.perms);</li>
     *   <li>管理员恒可(与其他面板一致);</li>
     *   <li>真正的闸门在 {@link SupplierPortalService#requireAccountConfig()} ——
     *       前端只做入口显隐,拿令牌直接调接口一样要过这个词。</li>
     * </ul>
     */
    private static final String[][] SUPPLIER_ACCOUNT_ACTIONS = {
            {"supplier", "配置供应商账号"},
    };
    /**
     * 项目流程管控(2026-10-20):**只读**盯单页 —— 查流程走到哪一步、卡在谁手上。
     * 页面本身不写任何单据(要补审批/定级/确认都回原面板操作),故动作只有可见 + 查询。
     */
    private static final String[][] PROJECT_FLOW_ACTIONS = {
            {"view",  "可见"},
            {"query", "查询"},
    };
    /**
     * 工序流程追踪卡(2026-10-29):录入照片 = 建卡/上传删除照片(动作词 entry);
     * 确认完成 = 卡状态置「已完成」(动作词 confirm,前置=全部工序已完工且每道至少一张照片)。
     * 列表/批次追溯只读,挂 query。
     */
    private static final String[][] PROC_FLOW_CARD_ACTIONS = {
            {"view",    "可见"},
            {"query",   "查询"},
            {"entry",   "录入照片"},
            {"confirm", "确认完成"},
    };

    /** 全部页面面板(顺序 = 矩阵内展示顺序;模块名与 {@code ReportService.NAV_GROUP_ORDER} 一致) */
    public static final List<PagePanelDef> ALL = List.of(
            // 2026-10-20 导航改版:「生产制造」一级目录拆掉,这四个看板所属分组合并为「生产计划」
            //   (与 menus.js 的 top-level「生产计划」/「生产过程」对应,权限矩阵按此分组)
            new PagePanelDef(ORDER_CONVERT, "订单结转", "生产计划", ORDER_CONVERT_ACTIONS),
            new PagePanelDef(SCHEDULE_BOARD, "快速排产", "生产计划", SCHEDULE_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_BOARD, "工单排产", "生产计划", WORK_ORDER_BOARD_ACTIONS),
            new PagePanelDef(WORK_ORDER_LIST, "生产工单", "生产计划", WORK_ORDER_LIST_ACTIONS),
            // ══════════ 2026-10-30 新一级目录「手机扫码」(与「生产计划」平级)══════════
            // 生产领料(2026-10-20 首建 → 2026-10-30 重写并迁入本组)、工序报工(2026-10-21 → 迁入本组)
            // 与「自动打印」站点页同属一个一级目录,故 module 一律写「手机扫码」
            // (ReportService.NAV_GROUP / NAV_GROUP_ORDER 已同步登记,权限矩阵按此分组展示)。
            // 2026-10-30 第二轮:「生成工单领料/退料单」是**独立面板**(开单工作台),排在领料之前
            new PagePanelDef(MOBILE_PICK_CREATE, "生成工单领料/退料单", "手机扫码", MOBILE_PICK_CREATE_ACTIONS),
            new PagePanelDef(MOBILE_PICK, "生产领料", "手机扫码", MOBILE_PICK_ACTIONS),
            new PagePanelDef(MOBILE_REPORT, "工序报工", "手机扫码", PROD_REPORT_ACTIONS),
            new PagePanelDef(PRINT_STATION, "自动打印", "手机扫码", PRINT_STATION_ACTIONS),
            // 2026-10-29:工序流程追踪卡(批次 → 小批次 → 工序照片 → 追溯)。
            // 它属于「生产计划」组(工序维度的看板),不随生产领料/工序报工迁到「手机扫码」。
            new PagePanelDef(PROC_FLOW_CARD, "工序流程追踪卡", "生产计划", PROC_FLOW_CARD_ACTIONS),
            new PagePanelDef(ERP_INTEG, "ERP集成配置清单", "ERP系统集成", ERP_INTEG_ACTIONS),
            // 2026-10-20 补登:数采平台三页 + 扫码领料(此前菜单里无面板码 ⇒ 矩阵里缺这几个)
            new PagePanelDef(DC_CONFIG, "IOT设备配置", "数采平台", DC_CONFIG_ACTIONS),
            new PagePanelDef(DC_MONITOR, "数据监控", "数采平台", DC_MONITOR_ACTIONS),
            new PagePanelDef(DC_STATS, "状态统计", "数采平台", DC_STATS_ACTIONS),
            // ⚠ 模块名以远端改版为准(2026-10-20 导航改版:「WMS管理系统」→「WMS管理」)
            new PagePanelDef(BARCODE_SCAN_PICK, "扫码领料", "WMS管理", BARCODE_SCAN_PICK_ACTIONS),
            // 2026-10-21:工单扫码领料(手机端,按工单+BOM 作业)
            new PagePanelDef(WORK_ORDER_PICK, "工单扫码领料", "WMS管理", WORK_ORDER_PICK_ACTIONS),
            // 2026-10-20:研发管理·项目管理 → 项目流程管控(归「研发管理」组,与菜单一级目录一致)
            new PagePanelDef(PROJECT_FLOW, "项目流程管控", "研发管理", PROJECT_FLOW_ACTIONS),
            // 2026-10-24 用户口径:「采购管理里面多增加俩个面版,一个是供应商采购打印面版,一个是供应商权限配置」
            //   两者都挂在「智能供应链 > 采购管理」下(menus.js 同步),故分组=智能供应链。
            new PagePanelDef(SUPPLIER_PRINT, "供应商采购打印", "智能供应链", SUPPLIER_PRINT_ACTIONS),
            new PagePanelDef(SUPPLIER_ACCOUNT, "供应商权限配置", "智能供应链", SUPPLIER_ACCOUNT_ACTIONS));

    private static final Map<String, PagePanelDef> BY_CODE = buildIndex();

    /**
     * 旧面板码 → 新面板码(2026-10-30「手机扫码」导航改版)。
     *
     * <p>为什么要别名:两个页面的面板码随导航改版换了名(PROD_PICK → MOBILE_PICK、
     * PROD_REPORT → MOBILE_REPORT),而 {@code yj_role_panel} 里**每个角色各有一行**按旧码授权、
     * {@code yj_translation} 里也按旧的中文名存了译名。若直接删旧码:
     * <ul>
     *   <li>那些账号会突然失去访问权(菜单消失、后端 403),而管理员并不知道要重新勾;</li>
     *   <li>旧客户端的 {@code visiblePanels} 判据也会失效。</li>
     * </ul>
     * ⇒ 旧码保留为别名,{@link #byCode} 回落到新定义(动作集/分组都与新码一致),
     * 权限矩阵里那行授权照样生效。**不要**把别名加回 {@link #ALL} —— 那会在矩阵里出现重复的两行。
     */
    private static final Map<String, String> ALIASES = Map.of(
            PROD_PICK, MOBILE_PICK,
            PROD_REPORT, MOBILE_REPORT);

    private PagePanelRegistry() { }

    private static Map<String, PagePanelDef> buildIndex() {
        Map<String, PagePanelDef> m = new LinkedHashMap<>();
        for (PagePanelDef d : ALL) m.put(d.code(), d);
        return Map.copyOf(m);
    }

    /**
     * 按编码取定义;非页面面板返回 null。
     *
     * <p>旧码走 {@link #ALIASES} 回落到新定义(返回值里的 {@code code()} 是**新码**)——
     * 调用方拿它做权限校验时请用 {@link #canonical} 归一,别直接用入参。
     */
    public static PagePanelDef byCode(String code) {
        if (code == null) return null;
        String c = code.trim();
        PagePanelDef d = BY_CODE.get(c);
        if (d != null) return d;
        String target = ALIASES.get(c);
        return target == null ? null : BY_CODE.get(target);
    }

    /**
     * 把面板码归一到**现行码**:旧码 → 新码,其余原样返回(null 原样 null)。
     *
     * <p>用途:服务端闸门按面板码查 {@code yj_role_panel} 时,客户端可能还在用旧码发请求
     * (老 App 缓存 / 书签 / 旧前端产物),两边都要能通过 —— 授权行究竟落在旧码还是新码
     * 取决于那次改版前后是哪个脚本写的,故校验时**新旧两个码都要认**。
     */
    public static String canonical(String code) {
        if (code == null) return null;
        String c = code.trim();
        if (BY_CODE.containsKey(c)) return c;
        String target = ALIASES.get(c);
        return target == null ? c : target;
    }

    /** 该码的全部等价写法(现行码 + 指向它的旧别名),用于「新旧码任一条授权即放行」的校验 */
    public static List<String> aliasesOf(String code) {
        String c = canonical(code);
        if (c == null) return List.of();
        List<String> out = new java.util.ArrayList<>();
        out.add(c);
        for (var e : ALIASES.entrySet()) if (e.getValue().equals(c) && !out.contains(e.getKey())) out.add(e.getKey());
        return List.copyOf(out);
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
