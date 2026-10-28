<!-- ============================================================================
     SupplierPrintPanel.vue — 「供应商采购打印」= 采购订单面板 + 面板码覆盖(2026-10-25)
     ----------------------------------------------------------------------------
     用户口径:「供应商打印面版的前端要与采购订单一致。只是显示和权限不一样。」

     PanelxList 的面板码取自 `route.params.panelCode`(入口形如 /panelx/list/PU_ORDER),
     而供应商端的地址是 `/scm/supplierPrint`(没有这个参数)。
     本组件**不复制任何面板逻辑**,只做一件事:用 vue-router 自己的 `routeLocationKey` 给子树
     提供一个**真实的 route 对象副本 + panelCode='PU_ORDER'**,再把同一个 PanelxList 挂起来
     —— 于是渲染出来的就是**采购订单面板本身**(左栏单据选择、明细页签、纸张、工具栏、打印出口全同)。

     为什么提供副本而不是伪造对象:PanelxList 还读 route.query / route.path / route.meta(页签、
     查询参数、操作名),伪造对象缺键会抛错;副本是在真实 route 上只改一个 params 键,
     其余键(path/query/meta/matched…)原样继承,行为与真在采购订单页一致。

     为什么不用「复制一份列表」:两套列表必然漂移(上一版自建表格就与采购订单的列/打印入口不一致,
     用户因此提了这个需求)。复用同一组件 ⇒ 采购订单以后加列、改版式、加打印格式,供应商端自动跟着变。

     只读与数据范围不在本组件做,而在 PanelxList 内按「供应商会话」(登录态 supplierCode)判定:
       · 工具栏只留浏览动作(supplierReadonly);
       · 取数带 condition.__supplierScope,后端 QueryService 折成「供应商编码 LIKE 值」强制进 WHERE。
     服务端另有 SupplierPortalGuardFilter 把供应商会话的其余 /api 一律 403。
     ============================================================================ -->
<template>
  <div class="sfp-wrap">
    <PanelxList />
  </div>
</template>

<script setup>
import { provide } from 'vue'
import { useRoute, useRouter, routeLocationKey, routerKey } from 'vue-router'
import PanelxList from '@core/views/PanelxList.vue'

const realRoute = useRoute()
const realRouter = useRouter()

/**
 * 面板码覆盖:只改 params.panelCode,其余键从真实 route 继承。
 *
 * ⚠ 用 `Object.create(realRoute)` 做**原型链继承**:route 是 vue-router 的响应式对象,
 * 继承后读取任何键仍走同一份响应式(切页签/换 query 时子组件照常更新),而 `params` 是唯一被覆盖的键。
 * 直接 spread 一份快照会在路由变化后变旧(页签高亮/query 取不到)。
 */
const panelRoute = Object.create(realRoute)
Object.defineProperty(panelRoute, 'params', {
  get: () => ({ ...realRoute.params, panelCode: 'PU_ORDER' }),
  enumerable: true,
})
provide(routeLocationKey, panelRoute)

/**
 * 路由器:给子组件一个**只代理** currentRoute 的包装。
 *
 * 为什么要包一层:PanelxList 里有大量 `base = route.path` 再 `router.push({ path: base, query: { docNo } })`
 * 的写法(切单定位/查询方案),供应商端若把这些 push 到真实路由器,会把地址从
 * /scm/supplierPrint 换到 /panelx/list/PU_ORDER ——**就绕出了供应商门户**(那个页面在没有
 * supplierCode 改写时会按普通采购订单面板渲染)。
 * 这里把 `currentRoute` 指回覆盖 route,于是 base 恒为 /scm/supplierPrint;
 * 至于 `push`:门户场景本就不该导航到别的单据(左栏切单只改内部游标),故直接**拦掉并返回已解决的 Promise**,
 * 不改变地址、不报错。将来若真有供应商端要跳转的需求,在这里显式放行一条即可。
 */
const routerProxy = {
  get currentRoute() { return panelRoute },
  get options() { return realRouter.options },
  push: () => Promise.resolve(),
  replace: () => Promise.resolve(),
  resolve: (to) => realRouter.resolve(to),
  go: () => {},
  back: () => {},
  addRoute: (...args) => realRouter.addRoute(...args),
  removeRoute: (...args) => realRouter.removeRoute(...args),
  hasRoute: (name) => realRouter.hasRoute(name),
  getRoutes: () => realRouter.getRoutes(),
  beforeEach: (...args) => realRouter.beforeEach(...args),
  afterEach: (...args) => realRouter.afterEach(...args),
  onError: (...args) => realRouter.onError(...args),
}
provide(routerKey, routerProxy)
</script>

<style scoped>
.sfp-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
</style>
