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
 * 这组断言守的是 2026-09-22 用户的要求:
 * 「我的桌面的右上角的按钮可以自定义,比如可以加入项目申请(填写立项申请表)
 *  和产品开发(填写产品信息表)」。
 *
 * 背景(实查得出,别退回旧写法):
 *  · 按钮清单原先写死在 dashboard/index.vue 里,「工作台设置」弹窗又各写一份硬编码
 *    checkbox —— 两边会漂移(设置里能勾的 ≠ 桌面能显示的),所以收敛成这一份真源。
 *  · 面板码实查自 HSDZ_MES.yj_panel:立项申请 = RD_APPROVAL,产品信息表 = RD_PROD_INFO,
 *    项目实施计划 = RD_PLAN(后者不是本次入口,勿混)。
 *  · 新增走 /panelx/form/<面板码>(无 id 即新增,PanelxForm 的 isEdit=false),
 *    与既有「新建加工单 → /panelx/form/MANU_ORDER」同款。
 *  · 用户可见面板用 user.visiblePanels(与 filterMenuTree 同一份语义:admin 全量)。
 */

const ADMIN = { isAdmin: true, visiblePanels: [] }
const YUAN = { isAdmin: false, visiblePanels: ['RD_PROD_INFO', 'RD_APPROVAL', 'MANU_ORDER'] }
const WAREHOUSE = { isAdmin: false, visiblePanels: ['MANU_ORDER'] }

test('候选清单:含研发两个新入口,key 唯一,面板码指向正确', () => {
  const keys = QUICK_ENTRIES.map((e) => e.key)
  assert.equal(new Set(keys).size, keys.length, 'key 必须唯一')
  const apply = QUICK_ENTRIES.find((e) => e.key === 'rdApply')
  const product = QUICK_ENTRIES.find((e) => e.key === 'rdProduct')
  assert.equal(apply.panelCode, 'RD_APPROVAL')
  assert.equal(apply.path, '/panelx/form/RD_APPROVAL')
  assert.equal(product.panelCode, 'RD_PROD_INFO')
  assert.equal(product.path, '/panelx/form/RD_PROD_INFO')
  // 原有三个入口不能因为重构丢路径
  assert.deepEqual(
    QUICK_ENTRIES.filter((e) => ['newOrder', 'quickReport', 'board'].includes(e.key)).map((e) => e.path),
    ['/panelx/form/MANU_ORDER', '/prod/shop/procReport', '/prod/manufacture/board']
  )
})

test('未绑定面板的入口(快速报工/生产看板)对所有角色可见', () => {
  const keys = availableQuickEntries(WAREHOUSE).map((e) => e.key)
  assert.ok(keys.includes('quickReport'))
  assert.ok(keys.includes('board'))
  assert.ok(keys.includes('newOrder'), 'MANU_ORDER 在 visiblePanels 里')
})

test('绑定面板的入口:admin 全可见,普通用户按 visiblePanels 过滤', () => {
  assert.deepEqual(
    availableQuickEntries(ADMIN).map((e) => e.key),
    ['newOrder', 'quickReport', 'board', 'rdApply', 'rdProduct']
  )
  assert.deepEqual(
    availableQuickEntries(YUAN).map((e) => e.key),
    ['newOrder', 'quickReport', 'board', 'rdApply', 'rdProduct']
  )
  // 仓管没有研发面板:候选中不该出现研发入口(否则勾了也点不动)
  assert.deepEqual(availableQuickEntries(WAREHOUSE).map((e) => e.key), ['newOrder', 'quickReport', 'board'])
})

test('按勾选挑入口:只返回勾过且当前可见的,顺序跟候选清单一致', () => {
  const picked = pickQuickEntries(['rdProduct', 'newOrder'], ADMIN).map((e) => e.key)
  assert.deepEqual(picked, ['newOrder', 'rdProduct'], '渲染顺序由候选清单决定,不随勾选顺序乱')
  assert.deepEqual(pickQuickEntries(['rdApply', 'newOrder'], WAREHOUSE).map((e) => e.key), ['newOrder'])
  assert.deepEqual(pickQuickEntries(undefined, ADMIN), [], '存储值异常不该崩,按空处理')
})

test('老用户增量补默认(v1→v2):管理员补两个新入口,原有勾选保留', () => {
  const saved = { quick: ['quickReport', 'newOrder'], showKpi: false, showProgress: true, showTodo: false }
  const next = upgradeDeskSettings(saved, { presetQuick: ['newOrder', 'quickReport', 'board', 'rdApply', 'rdProduct'] })
  assert.deepEqual(next.quick, ['quickReport', 'newOrder', 'rdApply', 'rdProduct'])
  assert.equal(next.showKpi, false, '用户自己关掉的卡片不能被顺手打开')
  assert.equal(next.showTodo, false)
  assert.equal(next.v, DESK_QUICK_VERSION)
  assert.deepEqual(DESK_QUICK_V2_ADDED, ['rdApply', 'rdProduct'])
})

test('普通用户不补新入口;已是当前版本的原样返回(同一引用)', () => {
  const saved = { quick: ['quickReport'], showKpi: true, showProgress: false, showTodo: true }
  const forUser = upgradeDeskSettings(saved, { presetQuick: ['quickReport', 'newOrder', 'board'] })
  assert.deepEqual(forUser.quick, ['quickReport'])
  assert.equal(forUser.v, DESK_QUICK_VERSION)

  const current = { quick: ['quickReport'], v: DESK_QUICK_VERSION }
  assert.equal(upgradeDeskSettings(current, { presetQuick: ['quickReport', 'rdApply'] }), current)
  assert.equal(upgradeDeskSettings(null, { presetQuick: [] }), null)
})
