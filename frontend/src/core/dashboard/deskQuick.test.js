import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  QUICK_ENTRIES,
  DESK_QUICK_VERSION,
  DESK_QUICK_V2_ADDED,
  availableQuickEntries,
  pickQuickEntries,
  upgradeDeskSettings,
} from './deskQuick.js'

/**
 * 这组断言守的是 2026-09-22 用户的两条要求:
 *   ① 「我的桌面的右上角的按钮可以自定义,比如可以加入项目申请(填写立项申请表)和
 *      产品开发(填写产品信息表)」;
 *   ② 「快速报工和生产(看板)按钮去掉,现在是无效按钮,暂时无对应功能」。
 *
 * 背景(实查得出,别退回旧写法):
 *  · 按钮清单原先写死在 dashboard/index.vue 里,「工作台设置」弹窗又各写一份硬编码
 *    checkbox —— 两边会漂移(设置里能勾的 ≠ 桌面能显示的),所以收敛成这一份真源。
 *  · 面板码实查自 HSDZ_MES.yj_panel:立项申请 = RD_APPROVAL,产品信息表 = RD_PROD_INFO,
 *    生产加工单 = MANU_ORDER。项目实施计划 RD_PLAN 不是桌面入口,勿混。
 *  · 新增走 /panelx/form/<面板码>(无 id 即新增,PanelxForm 的 isEdit=false)。
 *  · 被下架的两个入口为什么是无效的:/prod/shop/procReport 在 router 里根本没有这条路由
 *    (只在 ModuleView.vue 里当占位 key),点了落到空页;ManufactureBoard.vue 自己写着
 *    「生产看板数据接口尚未接入 SQL 后端」。所以候选清单里不允许再出现它们
 *    —— 要恢复必须先有真功能与真路由,并补一条本文件的断言。
 *  · 每个入口都必须绑定 panelCode:桌面按钮按 user.visiblePanels 过滤(admin 全量,
 *    与 filterMenuTree 同语义)。不绑面板的入口等于人人可点却可能点不动,已被用户否掉。
 */

const ADMIN = { isAdmin: true, visiblePanels: [] }
const YUAN = { isAdmin: false, visiblePanels: ['MANU_ORDER', 'RD_APPROVAL', 'RD_PROD_INFO'] }
const WAREHOUSE = { isAdmin: false, visiblePanels: ['MANU_ORDER'] }

test('候选清单:三个有效入口,路径正确,且每个都绑定面板码', () => {
  const keys = QUICK_ENTRIES.map((e) => e.key)
  assert.deepEqual(keys, ['newOrder', 'rdApply', 'rdProduct'], '顺序即桌面渲染顺序')
  assert.equal(new Set(keys).size, keys.length, 'key 必须唯一')
  assert.deepEqual(
    QUICK_ENTRIES.map((e) => e.path),
    ['/panelx/form/MANU_ORDER', '/panelx/form/RD_APPROVAL', '/panelx/form/RD_PROD_INFO']
  )
  for (const e of QUICK_ENTRIES) {
    assert.ok(e.panelCode, e.key + ' 必须绑定面板码,否则权限无从判定')
  }
})

test('无效入口不得下发:快速报工/生产看板 暂无对应功能,已被移除', () => {
  const keys = QUICK_ENTRIES.map((e) => e.key)
  assert.ok(!keys.includes('quickReport'), '快速报工无路由,不得出现在候选里')
  assert.ok(!keys.includes('board'), '生产看板数据接口未接入,不得出现在候选里')
  const paths = QUICK_ENTRIES.map((e) => e.path)
  assert.ok(!paths.includes('/prod/shop/procReport'))
  assert.ok(!paths.includes('/prod/manufacture/board'))
})

test('权限过滤:admin 全可见,普通用户只看得到自己有权限的面板入口', () => {
  assert.deepEqual(availableQuickEntries(ADMIN).map((e) => e.key), ['newOrder', 'rdApply', 'rdProduct'])
  assert.deepEqual(availableQuickEntries(YUAN).map((e) => e.key), ['newOrder', 'rdApply', 'rdProduct'])
  assert.deepEqual(availableQuickEntries(WAREHOUSE).map((e) => e.key), ['newOrder'])
  assert.deepEqual(availableQuickEntries(undefined), [], '拿不到用户时宁可不显示')
})

test('按勾选挑入口:只返回勾过且可见的,顺序跟候选清单一致', () => {
  assert.deepEqual(pickQuickEntries(['rdProduct', 'newOrder'], ADMIN).map((e) => e.key), ['newOrder', 'rdProduct'])
  assert.deepEqual(pickQuickEntries(['rdApply', 'newOrder'], WAREHOUSE).map((e) => e.key), ['newOrder'])
  assert.deepEqual(pickQuickEntries(undefined, ADMIN), [], '存储值异常不该崩,按空处理')
})

test('老用户存储里的已下架入口(quickReport/board)不再渲染', () => {
  const legacy = ['newOrder', 'quickReport', 'board', 'rdApply', 'rdProduct']
  assert.deepEqual(pickQuickEntries(legacy, ADMIN).map((e) => e.key), ['newOrder', 'rdApply', 'rdProduct'])
})

test('老用户增量补默认(v1→v2):管理员补两个研发入口,原有勾选保留', () => {
  const saved = { quick: ['newOrder'], showKpi: false, showProgress: true, showTodo: false }
  const next = upgradeDeskSettings(saved, { presetQuick: ['newOrder', 'rdApply', 'rdProduct'] })
  assert.deepEqual(next.quick, ['newOrder', 'rdApply', 'rdProduct'])
  assert.equal(next.showKpi, false, '用户自己关掉的卡片不能被顺手打开')
  assert.equal(next.showTodo, false)
  assert.equal(next.v, DESK_QUICK_VERSION)
  assert.deepEqual(DESK_QUICK_V2_ADDED, ['rdApply', 'rdProduct'])
})

test('普通用户不补新入口;已是当前版本的原样返回(同一引用)', () => {
  const saved = { quick: ['newOrder'], showKpi: true, showProgress: false, showTodo: true }
  const forUser = upgradeDeskSettings(saved, { presetQuick: ['newOrder'] })
  assert.deepEqual(forUser.quick, ['newOrder'])
  assert.equal(forUser.v, DESK_QUICK_VERSION)

  const current = { quick: ['newOrder'], v: DESK_QUICK_VERSION }
  assert.equal(upgradeDeskSettings(current, { presetQuick: ['newOrder', 'rdApply'] }), current)
  assert.equal(upgradeDeskSettings(null, { presetQuick: [] }), null)
})
