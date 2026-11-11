import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { canViewPanel } from '@core/auth/panelAccess'
import { flatMenus } from '@/business/menus'

const ModuleView = () => import('@/views/modules/ModuleView.vue')
const PanelxList = () => import('@core/views/PanelxList.vue')
const PanelxForm = () => import('@core/views/PanelxForm.vue')

/**
 * 供应商账号登录后的**唯一落地页**(2026-10-24):供应商采购打印。
 * 与 menus.js 里 supplierPrint 的 path、以及后端 PagePanelRegistry.SUPPLIER_PRINT 一一对应。
 */
export const SUPPLIER_HOME = '/scm/supplierPrint'

const routes = [
  { path: '/login', component: () => import('@/views/login/index.vue'), meta: { title: '登录' } },
  // 生产领料 · 旧地址兼容(2026-10-20 第二轮:用户要求「两个写成一体的、地址要一致,
  //   在 panelx/list 目录下」⇒ 正式地址统一为 `/panelx/list/PROD_PICK`,与本文件里那条路由同一份组件)。
  //   这里只保留重定向,避免手机收藏/以前发的链接失效。
  // ⚠ 2026-10-30:正式地址已迁到「手机扫码」一级目录下的 /panelx/list/MOBILE_PICK(见下方该条路由)。
  //   PROD_PICK / PROD_REPORT 连同这三条旧路径一律**重定向**到新地址 ——
  //   老 App 内置链接、手机收藏、已发出去的二维码都不用重发。
  { path: '/m/pick', redirect: '/panelx/list/MOBILE_PICK', meta: { title: '生产领料' } },
  { path: '/prod/plan/prodPick', redirect: '/panelx/list/MOBILE_PICK', meta: { title: '生产领料' } },
  { path: '/panelx/list/PROD_PICK', redirect: '/panelx/list/MOBILE_PICK', meta: { title: '生产领料' } },
  { path: '/panelx/list/PROD_REPORT', redirect: '/panelx/list/MOBILE_REPORT', meta: { title: '工序报工' } },
  {
    path: '/',
    component: () => import('@/layout/PortalLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '我的桌面' } },
      // 2026-10-28:旧生产加工单 MANU_ORDER 下架,prod/manufacture/order(Form) 两条重定向一并移除
      { path: 'prod/manufacture/board', component: () => import('@/views/modules/board/ManufactureBoard.vue'), meta: { title: '生产看板', code: 'manufactureBoard' } },
      { path: 'prod/shop/reworkDesk', component: () => import('@/views/modules/rework/ReworkDesk.vue'), meta: { title: '返修工作台', code: 'reworkDesk' } },
      { path: 'top/solution', component: () => import('@/views/modules/solution/SolutionCenter.vue'), meta: { title: '方案中心', code: 'solutionCenter' } },
      // 系统管理平台(2026-10-18 改版):一级目录「系统管理平台」只留这一页系统功能入口 ——
      //   账号信息/修改密码/界面设置/工作台设置/换肤 + 组织架构、使用权限查看(管理员专属)。
      //   三张菜单叶子(sysConsole/sysOrg/sysUsage)同样要在下方 flatMenus 过滤里排除,否则重复注册。
      { path: 'sys/console', component: () => import('@/views/sys/SystemConsole.vue'), meta: { title: '系统管理平台', code: 'sysConsole' } },
      { path: 'sys/org', component: () => import('@/views/sys/OrgAdmin.vue'), meta: { title: '组织架构', requireAdmin: true } },
      { path: 'sys/usage', component: () => import('@/views/sys/UsageLog.vue'), meta: { title: '使用权限查看', requireAdmin: true } },
      // 数据安全 · 数据库备份(2026-10-19 用户口径「系统管理模块加一个面板,可以设置数据库数据的
      //   主动备份和自动备份的时间」):主动备份 / 自动备份时间 / 保留份数 / 备份记录。管理员专属
      //   (菜单 adminOnly + 路由 requireAdmin + 后端 requireAdmin 三层同源);不进 flatMenus 自动路由。
      { path: 'sys/backup', component: () => import('@/views/sys/DbBackup.vue'), meta: { title: '数据备份', requireAdmin: true } },
      // 菜单设计(2026-10-23):编辑导航的名称/上级分组/顺序/隐藏 —— 覆盖行存 yj_menu_node,
      //   保存即生效、不用重新打包部署。管理员专属(菜单 adminOnly + 路由 requireAdmin + 后端 requireAdmin)。
      { path: 'sys/menuDesign', component: () => import('@/views/sys/MenuDesigner.vue'), meta: { title: '菜单设计', requireAdmin: true } },
      // 自动打印站点(2026-10-30,「手机扫码」一级目录下):电脑上打开的一页,选打印机 + 开关自动打印,
      //   页面常驻轮询打印队列,收到手机端发来的工单二维码就静默出纸。
      // 页面级虚拟面板 PRINT_STATION(定义见后端 PagePanelRegistry)⇒ 不进 flatMenus 自动路由,显式注册。
      // 配置按浏览器 localStorage 绑本机(每台电脑设置自己那台打印机),不写库。
      { path: 'sys/printStation', component: () => import('@/views/sys/PrintStation.vue'), meta: { title: '自动打印', code: 'printStation', panelCode: 'PRINT_STATION' } },
      { path: 'scm/businessOverview', component: () => import('@/views/scm/BusinessOverview.vue'), meta: { title: '业务总览', code: 'businessOverview' } },
      // 数采平台(2026-10-18):IOT设备配置 / 数据监控 / 状态统计。三页是页面级叶子(非 yj_panel 面板),
      //   故不进 flatMenus 自动路由(下方 filter 已排除 dcConfig/dcMonitor/dcStats),在此显式注册。
      //   2026-10-20:三页补页面级虚拟面板码(DC_CONFIG/DC_MONITOR/DC_STATS) —— 此前无码 ⇒
      //   不进权限矩阵、任何登录账号都能进;后端同源闸门 DcController.requirePanelView。
      { path: 'dc/config', component: () => import('@/views/dc/DcConfig.vue'), meta: { title: 'IOT设备配置', code: 'dcConfig', panelCode: 'DC_CONFIG' } },
      { path: 'dc/monitor', component: () => import('@/views/dc/DcMonitor.vue'), meta: { title: '数据监控', code: 'dcMonitor', panelCode: 'DC_MONITOR' } },
      { path: 'dc/stats', component: () => import('@/views/dc/DcStats.vue'), meta: { title: '状态统计', code: 'dcStats', panelCode: 'DC_STATS' } },
      { path: 'scm/mobileWarehouse', component: () => import('@/views/scm/MobileWarehouse.vue'), meta: { title: '移动仓管', code: 'mobileWarehouse' } },
      { path: 'scm/serialNumber', component: () => import('@/views/scm/SerialNumber.vue'), meta: { title: '序列号管理', code: 'serialNumber' } },
      // 供应商门户(2026-10-24 起):
      //   · /scm/supplierAccount 供应商权限配置 —— **管理员 ∪ 组织架构授权了「配置供应商账号」的账号**
      //     (2026-10-25 用户口径「不只是管理员可以来配置,需要能够通过组织架构添加可以配置的账号」);
      //     用 meta.permKey 判(与菜单项 permKey、后端 requireAccountConfig 同源),不再是 requireAdmin。
      //     它不走通用 PanelxList,故仍不进 flatMenus 自动路由(菜单项带 panelCode 已被 filter 排除)。
      { path: 'scm/supplierAccount', component: () => import('@/views/scm/SupplierAccount.vue'), meta: { title: '供应商权限配置', code: 'supplierAccount', panelCode: 'SUPPLIER_ACCOUNT', permKey: 'canConfigSupplierAccount' } },
      // 供应商采购打印(2026-10-25 用户口径「是多做一个和采购订单一样的供应商面版,只有打印按钮和查询
      //   (查询必须只能查供应商关联的数据)按钮的」):
      //   面板 = SUPPLIER_PU_ORDER(bd_pu_order/bl_pu_order 的元数据副本,字段与采购订单逐列一致,
      //   工具栏只有「查询 + 打印」,见后端 PANDA_BUTTONS)。
      //   ⚠ 地址必须**带 :panelCode 参数**(PanelxList 的面板码取自 route.params.panelCode)——
      //     早先写成静态路径 /scm/supplierPrint ⇒ params 为空 ⇒ 组件判"面板编号无效"直接 return,
      //     不取配置也不取数(界面只剩一颗查询按钮,2026-10-25 实测踩到)。
      //     这里与「生产领料 /panelx/list/PROD_PICK」同一形态:静态地址 + props 固定面板码。
      //   供应商会话:菜单只剩这一条,数据由后端按登录态供应商编码强制过滤;内部账号也能进,看全量、同样只读。
      {
        path: 'scm/supplierPrint',
        component: PanelxList,
        props: { panelCode: 'SUPPLIER_PU_ORDER' },
        meta: { title: '供应商采购打印', code: 'supplierPrint', panelCode: 'SUPPLIER_PU_ORDER' },
      },
      // 兼容老地址/书签:直接落到标准面板地址
      { path: 'scm/supplierPrint/:panelCode', redirect: '/panelx/list/SUPPLIER_PU_ORDER' },
      // 扫码领料(2026-10-18):条码管理 → 扫码领料。页面级(无 panelCode),扫标签码 `存货编码|批号`
      // 按批号查 v_stock_pick 可用量 → 组材料出库单草稿。理由见 views/scm/ScanPick.vue 头注释。
      { path: 'scm/scanPick', component: () => import('@/views/scm/ScanPick.vue'), meta: { title: '扫码领料', code: 'barcodeScanPick', panelCode: 'BARCODE_SCAN_PICK' } },
      // 工单扫码领料(2026-10-21,手机端):扫工单码 → 按 BOM 列出该领的料 → 逐项扫物料码 →
      // 自动抓台车电子秤数量 → 整单提交生成材料出库单。页面级虚拟面板 WORK_ORDER_PICK
      // (定义见后端 PagePanelRegistry),理由与数据源见 views/scm/WorkOrderPick.vue 头注释。
      { path: 'scm/workOrderPick', component: () => import('@/views/scm/WorkOrderPick.vue'), meta: { title: '工单扫码领料', code: 'workOrderPick', panelCode: 'WORK_ORDER_PICK' } },
      // 扫码领料记录(2026-10-21):工单扫码领料的逐笔留痕查询 —— 谁/何时/哪张工单/哪个物料/多少。
      // 数据源 wo_pick_scan_log(只增不改),接口 GET /px/woPick/scanLogs。只读页面。
      { path: 'scm/pickScanLog', component: () => import('@/views/scm/PickScanLog.vue'), meta: { title: '扫码领料记录', code: 'pickScanLog', panelCode: 'WORK_ORDER_PICK' } },
      // ERP系统集成 · ERP集成配置清单(2026-10-18):导入/转出两向 × 分类的接口/设备/字段映射统一配置页。
      // 页面级虚拟面板 ERP_INTEG(定义见后端 PagePanelRegistry),菜单项带 panelCode ⇒ 不进 flatMenus 自动路由。
      { path: 'erp/integConfig', component: () => import('@/views/erp/ErpIntegConfig.vue'), meta: { title: 'ERP集成配置清单', code: 'erpIntegCfg', panelCode: 'ERP_INTEG' } },
      // 共享文件库(研发管理·全公司共享资料):panelCode=RD_SHARE_FILE 带权限,故不进 flatMenus 自动路由,显式注册
      { path: 'rd/shareFile', component: () => import('@/views/rd/ShareFileCenter.vue'), meta: { title: '共享文件库', code: 'rdShareFile' } },
      // 项目流程管控(研发管理·项目管理,2026-10-20):按立项单号查流程走到哪一步。
      // 页面级虚拟面板 PROJECT_FLOW(定义见后端 PagePanelRegistry)⇒ 不进 flatMenus 自动路由,显式注册。
      { path: 'rd/projectFlow', component: () => import('@/views/rd/ProjectFlow.vue'), meta: { title: '项目流程管控', code: 'rdFlow', panelCode: 'PROJECT_FLOW' } },
      // 产品文件流程管控（2026-11-11 用户口径）:把「产品文件列表 · 流程全览」升级成一个**专门的面板**,
      // 版式照 项目流程管控（KPI → 检索 → 清单 + 时间轴）。
      // 权限:不新造虚拟面板,直接挂 RD_PROD_DOCLIST 的查看权 —— 这份流程本来就是那张表的数据,
      // 没有它的查看权也不该看这条流程（省掉一条 yj_role_panel 迁移）。
      { path: 'rd/productFlow', component: () => import('@/views/rd/ProductFlow.vue'), meta: { title: '产品文件流程管控', code: 'rdProductFlow', panelCode: 'RD_PROD_DOCLIST' } },
      // 订单结转·发单工作台(方案 V1.0):待结转行→转工单/转采购单;不进 flatMenus 自动路由。
      // 2026-10-16 权限化:四处看板页面各挂**页面级虚拟面板码**(定义见后端 PagePanelRegistry),
      // meta.panelCode 供下方守卫拦「直接敲 URL」——菜单隐藏挡不住手输地址。
      { path: 'prod/plan/orderConvert', component: () => import('@/views/modules/plan/OrderConvert.vue'), meta: { title: '订单结转', code: 'orderConvert', panelCode: 'ORDER_CONVERT' } },
      // 排产工作台(实现总结 V1.0 §5):待排产池→排线→撤销
      { path: 'prod/plan/scheduleBoard', component: () => import('@/views/modules/plan/ScheduleBoard.vue'), meta: { title: '快速排产', code: 'scheduleBoard', panelCode: 'SCHEDULE_BOARD' } },
      // 工单排产(2026-09-23 纠偏,替代「生产排产」平铺看板):产线骨架+按线查看运行中工单
      { path: 'prod/plan/workOrderBoard', component: () => import('@/views/modules/plan/WorkOrderBoard.vue'), meta: { title: '工单排产', code: 'workOrderBoard', panelCode: 'WORK_ORDER_BOARD' } },
      // 工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 报表式列表页)
      { path: 'prod/plan/workOrderList', component: () => import('@/views/modules/plan/WorkOrderList.vue'), meta: { title: '工单排产·列表', code: 'workOrderList', panelCode: 'WORK_ORDER_LIST' } },
      // 生产工序进度看板(2026-11-08 用户口径「生产工单进度需要做一个看板,方便直观查看工单各工序进度」):
      //   一行=一张工单行(工单号+工单行号),大屏/列表双视图;工序进度口径复用「工单详情·追溯」;
      //   点行跳「生产工单」页并定位该工单(WorkOrderList 支持 ?keyword=&focus= 定位)。
      //   页面级虚拟面板 WORK_ORDER_PROGRESS(定义见后端 PagePanelRegistry)⇒ 不进 flatMenus 自动路由。
      { path: 'prod/plan/workOrderProgress', component: () => import('@/views/modules/plan/WorkOrderProgressBoard.vue'), meta: { title: '生产工序进度看板', code: 'workOrderProgress', panelCode: 'WORK_ORDER_PROGRESS' } },
      // ══════════ 手机扫码(2026-10-30 新增一级目录)══════════
      // 用户口径:「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』(和生产计划平级)
      //   导航下。工序报工不变。生产领料重写。」
      // 两条都仍是**页面级虚拟面板**(MOBILE_PICK / MOBILE_REPORT,定义见后端 PagePanelRegistry,
      //   不是 yj_panel 的单据表),地址走标准面板形态 `/panelx/list/<码>`;因为是专用页面而不是
      //   通用 PanelxList,这两条**必须排在下面 `panelx/list/:panelCode` 之前**(静态路径优先于参数路径)。
      // 旧地址 /panelx/list/PROD_PICK、/panelx/list/PROD_REPORT 在本文件顶部已重定向到新地址。
      // ⚠ 2026-10-21 用户口径:「扫码领料应该是整个图片上红色的窗口保留」—— 即手机上也要
      //   留着顶栏 + 页签,不要沉浸。故这两条**不加 immersiveOnMobile**。
      //
      // 生产领料(2026-10-30 重写):列表页 = 未完成/已完成两组单据 + 中间扫码定位;生单在下面那张独立面板。
      {
        path: 'panelx/list/MOBILE_PICK', component: () => import('@/views/mobile/MobilePickList.vue'),
        meta: { title: '生产领料', code: 'mobilePick', panelCode: 'MOBILE_PICK' },
      },
      // 生成工单领料/退料单(2026-10-30 第二轮用户口径:「还有少了一个『生成工单领料/退料单』这个面版,
      //   这个面版的功能和生成领料是有区别的(不是一个面版),重新分析需求」+ 三问确认:
      //   电脑上的**开单工作台**(可扫多张工单批量生成、列表看已生成的单),**只管生单**,生完引导去领料。
      //   必须排在 `panelx/list/:panelCode` 之前,理由同上。
      {
        path: 'panelx/list/MOBILE_PICK_CREATE', component: () => import('@/views/mobile/MobilePickCreate.vue'),
        meta: { title: '生成工单领料/退料单', code: 'mobilePickCreate', panelCode: 'MOBILE_PICK_CREATE' },
      },
      // 单据详情(领料 / 退料两页签):扫物料码核销、批次沿用旧逻辑、全部领完才能提交。
      // 必须排在 `panelx/list/:panelCode` 之前,理由同上。
      {
        path: 'panelx/list/MOBILE_PICK/doc', component: () => import('@/views/mobile/MobilePickDoc.vue'),
        meta: { title: '生产领料单', code: 'mobilePickDoc', panelCode: 'MOBILE_PICK' },
      },
      // 工序报工(2026-10-21 原样搬迁,页面逻辑一行不动):扫工单 → 选工序 → 填完工数量 → 提交。
      {
        path: 'panelx/list/MOBILE_REPORT', component: () => import('@/views/mobile/MobileReport.vue'),
        meta: { title: '工序报工', code: 'mobileReport', panelCode: 'MOBILE_REPORT' },
      },
      // ══════════ 实验室记录手机登记(2026-11-09 用户口径)══════════
      // 「研发图片上的 3 个面版也要对应的做手机端,在手机扫码下面,叫实验室记录手机登记。
      //   手机端只需要实现,可以拍照上传和可以填写对应字段的内容就可以。再要一个模糊查询。
      //   还有数据要可以对应回填各自的面版…」
      // 三页共用一个组件(views/mobile/MobileLabRecord.vue),面板码就是研发管理里那三张 PC 面板
      // ⇒ **不是新表、新面板**:手机存的就是同一个面板里的同一张单(保存为草稿),电脑端直接看到。
      // 因为面板码复用 PC 那三份,权限行/译名/参照链一律不动,也不需要往 PagePanelRegistry 加码。
      // ⚠ 必须排在下面 `panelx/list/:panelCode` 参数路由**之前**(静态路径优先),否则会被当成面板码。
      {
        path: 'panelx/list/MOBILE_LAB_SPIKE_WATER',
        component: () => import('@/views/mobile/MobileLabRecord.vue'),
        meta: { title: '加标水配置记录表', code: 'mobileLabSpikeWater', panelCode: 'RD_SPIKE_WATER' },
      },
      {
        path: 'panelx/list/MOBILE_LAB_EQUIP_USE',
        component: () => import('@/views/mobile/MobileLabRecord.vue'),
        meta: { title: '设备使用登记表', code: 'mobileLabEquipUse', panelCode: 'RD_EQUIP_USE' },
      },
      {
        path: 'panelx/list/MOBILE_LAB_INSTR_USE',
        component: () => import('@/views/mobile/MobileLabRecord.vue'),
        meta: { title: '仪器使用记录表', code: 'mobileLabInstrUse', panelCode: 'RD_INSTR_USE' },
      },
      // 工序流程追踪卡(2026-10-29,生产计划):日期大批次 → 小批次(工单行)→ 工序照片 → 按卡追溯。
      //   页面级虚拟面板 PROC_FLOW_CARD(定义见后端 PagePanelRegistry,不是 yj_panel 单据表);
      //   菜单项同名挂 panelCode,meta.panelCode 供路由守卫拦「直接敲 URL」。
      { path: 'prod/plan/procFlowCard', component: () => import('@/views/modules/plan/ProcFlowCard.vue'), meta: { title: '工序流程追踪卡', code: 'procFlowCard', panelCode: 'PROC_FLOW_CARD' } },
      // 烧结工艺清单 = **一个导航入口 + 两个模板 Tab**(2026-10-30 用户口径「把这个x烧结面板放到
      //   烧结面板里面去,做成一个双面板设计的一个总面板……最外的导航栏还是成型工艺清单,
      //   但是里面是两个不同的操作的面板」)。
      //   两个模板绑**不同的表**(rd_mold_proc_* / rd_x_sinter_*),各自独立建单 ——
      //   同一产品可以只填一个,也可以两个都填,所以不是一张单的两个页签。
      //   两条静态路由都指向同一容器组件 ⇒ **必须排下面 `panelx/list/:panelCode` 参数路由之前**;
      //   地址随 Tab 走(容器内 router.replace) ⇒ 刷新/收藏/分享都落在同一个 Tab。
      {
        path: 'panelx/list/RD_MOLD_PROC',
        component: () => import('@core/views/MoldProcPanel.vue'),
        props: { panelCode: 'RD_MOLD_PROC' },
        meta: { title: '烧结工艺清单', panelCode: 'RD_MOLD_PROC' },
      },
      {
        path: 'panelx/list/RD_X_SINTER',
        component: () => import('@core/views/MoldProcPanel.vue'),
        props: { panelCode: 'RD_X_SINTER' },
        meta: { title: 'X烧结工艺清单', panelCode: 'RD_X_SINTER' },
      },
      // ── 以上为远端新增(X烧结并入烧结工艺清单为双模板 Tab),与本地「工序流程追踪卡」互不冲突,两条都保留 ──
      { path: 'panelx/list/:panelCode', component: PanelxList, meta: { title: '单据', operationName: '新增流程' } },
      { path: 'panelx/form/:panelCode', component: PanelxForm, meta: { title: '表单' } },
      ...flatMenus()
        .filter((m) => m.path && m.path !== '/dashboard' && m.code !== 'manufactureOrder' && m.code !== 'manufactureBoard' && m.code !== 'reworkDesk' && m.code !== 'solutionCenter' && m.code !== 'orderConvert' && m.code !== 'scheduleBoard' && m.code !== 'workOrderBoard' && m.code !== 'workOrderList' && m.code !== 'sysConsole' && m.code !== 'sysOrg' && m.code !== 'sysUsage' && m.code !== 'sysBackup' && m.code !== 'dcConfig' && m.code !== 'dcMonitor' && m.code !== 'dcStats' && m.code !== 'barcodeScanPick' && m.code !== 'supplierPrint' && m.code !== 'supplierAccount' && m.code !== 'printStation' && !m.panelCode)
        .map((m) => ({
          path: m.path.slice(1),
          component: ModuleView,
          meta: { title: m.title, code: m.code },
        })),
    ],
  },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/error/404.vue'), meta: { title: '404' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由懒加载失败(部署后旧 chunk 404 / 网络瞬断)→ 自动重载一次(2026-10-18)。
// 不处理的话:点菜单后组件永远加载不出来,界面一直停在加载态(现场看到的"转圈")。
// 重载函数由 main.js 挂在 window 上(60 秒节流 + _r 破缓存),这里只负责识别错误类型。
router.onError((err) => {
  const msg = String((err && err.message) || '')
  if (/dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(msg)) {
    if (typeof window !== 'undefined' && window.__MES_RELOAD_ONCE__) window.__MES_RELOAD_ONCE__('route chunk: ' + msg)
  }
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || ''} · YINJIA-MES`
  const user = useUserStore()
  // 供应商会话(2026-10-24 用户口径「只能看到供应商采购打印面版……没有别的权限」):
  //   登录/会话还原时后端已把 visiblePanels 裁到只剩 SUPPLIER_PRINT,这里再加一道**显式出口守卫** ——
  //   敲 URL 进任何别的页面(含 /dashboard)一律送回 供应商采购打印。真正的闸门在后端
  //   SupplierPortalGuardFilter(供应商会话的 /api 请求只放行门户接口),本守卫只负责"别把人带进死路"。
  if (user.isLogin && user.supplierCode) {
    return to.path === SUPPLIER_HOME ? true : SUPPLIER_HOME
  }
  if (to.path !== '/login' && !user.isLogin) return '/login'
  if (to.meta.requireAdmin && !user.isAdmin) return '/dashboard'
  // 按登录用户身上的布尔位守卫(2026-10-25):组织架构授权的页面(供应商权限配置)不是 adminOnly,
  // 判定读 user[meta.permKey](canConfigSupplierAccount),与菜单项 permKey 同源。
  if (to.meta.permKey && user.isLogin && !user[to.meta.permKey]) return '/dashboard'
  if (to.path === '/login' && user.isLogin) return '/dashboard'
  // 页面级面板守卫(2026-10-16):直接敲 URL 也要拦 —— 菜单隐藏只是显示层,
  // 订单结转/快速排产/工单排产/生产工单四个看板页面此前没有面板码,任何人都能直连。
  // 口径与菜单 LeftNav(filterMenuTree)、后端 requirePanelView 同源(visiblePanels)。
  if (to.meta.panelCode && user.isLogin && !canViewPanel(user, to.meta.panelCode)) return '/dashboard'
  // 我的桌面权限化:无可见权限时落到第一个可见面板(直接敲 /dashboard 也跳走)
  if (to.path === '/dashboard' && user.isLogin && !user.isAdmin
      && !(user.visiblePanels || []).includes('DASHBOARD')) {
    const first = flatMenus().find((m) => m.panelCode && m.path && (user.visiblePanels || []).includes(m.panelCode))
    if (first) return first.path
  }
  return true
})

export default router
