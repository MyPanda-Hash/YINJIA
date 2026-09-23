import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { flatMenus } from '@/business/menus'

const ModuleView = () => import('@/views/modules/ModuleView.vue')
const PanelxList = () => import('@core/views/PanelxList.vue')
const PanelxForm = () => import('@core/views/PanelxForm.vue')

const routes = [
  { path: '/login', component: () => import('@/views/login/index.vue'), meta: { title: '登录' } },
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
      { path: 'sys/org', component: () => import('@/views/sys/OrgAdmin.vue'), meta: { title: '组织架构', requireAdmin: true } },
      { path: 'sys/usage', component: () => import('@/views/sys/UsageLog.vue'), meta: { title: '使用权限查看', requireAdmin: true } },
      { path: 'scm/businessOverview', component: () => import('@/views/scm/BusinessOverview.vue'), meta: { title: '业务总览', code: 'businessOverview' } },
      { path: 'scm/mobileWarehouse', component: () => import('@/views/scm/MobileWarehouse.vue'), meta: { title: '移动仓管', code: 'mobileWarehouse' } },
      { path: 'scm/serialNumber', component: () => import('@/views/scm/SerialNumber.vue'), meta: { title: '序列号管理', code: 'serialNumber' } },
      // 共享文件库(研发管理·全公司共享资料):panelCode=RD_SHARE_FILE 带权限,故不进 flatMenus 自动路由,显式注册
      { path: 'rd/shareFile', component: () => import('@/views/rd/ShareFileCenter.vue'), meta: { title: '共享文件库', code: 'rdShareFile' } },
      // 订单结转·发单工作台(方案 V1.0):待结转行→转工单/转采购单;panelCode 无,按 SO_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/orderConvert', component: () => import('@/views/modules/plan/OrderConvert.vue'), meta: { title: '订单结转', code: 'orderConvert' } },
      // 排产工作台(实现总结 V1.0 §5):待排产池→排线→撤销;按 MANU_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/scheduleBoard', component: () => import('@/views/modules/plan/ScheduleBoard.vue'), meta: { title: '排产工作台', code: 'scheduleBoard' } },
      // 工单排产(2026-09-23 纠偏,替代「生产排产」平铺看板):产线×班别骨架+按线查看运行中工单;按 MANU_ORDER 授权,不进 flatMenus 自动路由
      { path: 'prod/plan/workOrderBoard', component: () => import('@/views/modules/plan/WorkOrderBoard.vue'), meta: { title: '工单排产', code: 'workOrderBoard' } },
      { path: 'panelx/list/:panelCode', component: PanelxList, meta: { title: '单据', operationName: '新增流程' } },
      { path: 'panelx/form/:panelCode', component: PanelxForm, meta: { title: '表单' } },
      ...flatMenus()
        .filter((m) => m.path && m.path !== '/dashboard' && m.code !== 'manufactureOrder' && m.code !== 'manufactureBoard' && m.code !== 'reworkDesk' && m.code !== 'solutionCenter' && m.code !== 'orderConvert' && m.code !== 'scheduleBoard' && m.code !== 'workOrderBoard' && !m.panelCode)
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

router.beforeEach((to) => {
  document.title = `${to.meta.title || ''} · YINJIA-MES`
  const user = useUserStore()
  if (to.path !== '/login' && !user.isLogin) return '/login'
  if (to.meta.requireAdmin && !user.isAdmin) return '/dashboard'
  if (to.path === '/login' && user.isLogin) return '/dashboard'
  // 我的桌面权限化:无可见权限时落到第一个可见面板(直接敲 /dashboard 也跳走)
  if (to.path === '/dashboard' && user.isLogin && !user.isAdmin
      && !(user.visiblePanels || []).includes('DASHBOARD')) {
    const first = flatMenus().find((m) => m.panelCode && m.path && (user.visiblePanels || []).includes(m.panelCode))
    if (first) return first.path
  }
  return true
})

export default router
