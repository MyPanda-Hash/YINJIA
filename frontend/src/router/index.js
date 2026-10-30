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
  { path: '/m/pick', redirect: '/panelx/list/PROD_PICK', meta: { title: '生产领料' } },
  { path: '/prod/plan/prodPick', redirect: '/panelx/list/PROD_PICK', meta: { title: '生产领料' } },
  {
    path: '/',
    component: () => import('@/layout/PortalLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '我的桌面' } },
      { path: 'prod/manufacture/order', redirect: '/panelx/list/MANU_ORDER' },
      { path: 'prod/manufacture/orderForm', redirect: '/panelx/form/MANU_ORDER' },
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
      // 生产领料(2026-10-20):**地址统一到面板目录** —— 用户口径「两个要写成一体的,地址要一致,
      //   最好是在 panelx/list 的目录下方」。
      //   它仍然是**页面级虚拟面板**(PROD_PICK,定义见 PagePanelRegistry,不是 yj_panel 的单据表),
      //   但地址走标准面板形态 `/panelx/list/PROD_PICK`;因为是专用页面而不是通用 PanelxList,
      //   这条**必须排在下面 `panelx/list/:panelCode` 之前**(静态路径优先于参数路径)。
      //   电脑端与手机端同一地址:窄屏单列 + 吸底栏,≥900px 双栏(同一份组件自适应)。
      //   旧的 `/prod/plan/prodPick`、`/m/pick` 保留为重定向,老链接/收藏不失效。
      // ⚠ 2026-10-21 用户口径:「扫码领料应该是整个图片上红色的窗口保留」—— 即手机上也要
      //   留着顶栏 + 页签,不要沉浸。故这条**去掉 immersiveOnMobile**;PortalLayout 的沉浸能力
      //   保留(以后别的页要用),但当前没有任何路由启用它。
      { path: 'panelx/list/PROD_PICK', component: () => import('@/views/mobile/MobilePick.vue'), meta: { title: '生产领料', code: 'prodPick', panelCode: 'PROD_PICK' } },
      // 工序报工(2026-10-21):与生产领料同一形态 —— 页面级虚拟面板 + 标准面板地址 `/panelx/list/<码>`,
      //   必须排在上面的参数路由之前;手机单列、电脑 ≥900px 双栏(同一份组件)。
      { path: 'panelx/list/PROD_REPORT', component: () => import('@/views/mobile/MobileReport.vue'), meta: { title: '工序报工', code: 'prodReport', panelCode: 'PROD_REPORT' } },
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
      { path: 'panelx/list/:panelCode', component: PanelxList, meta: { title: '单据', operationName: '新增流程' } },
      { path: 'panelx/form/:panelCode', component: PanelxForm, meta: { title: '表单' } },
      ...flatMenus()
        .filter((m) => m.path && m.path !== '/dashboard' && m.code !== 'manufactureOrder' && m.code !== 'manufactureBoard' && m.code !== 'reworkDesk' && m.code !== 'solutionCenter' && m.code !== 'orderConvert' && m.code !== 'scheduleBoard' && m.code !== 'workOrderBoard' && m.code !== 'workOrderList' && m.code !== 'sysConsole' && m.code !== 'sysOrg' && m.code !== 'sysUsage' && m.code !== 'sysBackup' && m.code !== 'dcConfig' && m.code !== 'dcMonitor' && m.code !== 'dcStats' && m.code !== 'barcodeScanPick' && m.code !== 'supplierPrint' && m.code !== 'supplierAccount' && !m.panelCode)
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
