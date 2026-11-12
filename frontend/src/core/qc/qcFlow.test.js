/**
 * qcFlow 单测 —— 「品质流程监控」(QC_FLOW)的三个纯判定:
 *   ① 单据状态 → 展示档位(与后端 QcFlowService 的 5 档折叠一一对应);
 *   ② 一行业务数据 → 送料 / 检验 / 入库 三个节点的时态(含「免检」「未生成」);
 *   ③ 跳转前的能力判定 —— **没有目标面板查看权就不能跳**(用户 2026-11-12 原话)。
 *
 * 为什么要钉这三条:看板上的三种"看起来差不多"的灰/彩色节点,分别代表
 * 「还没生成单据」「免检跳过」「作废」,判定错一处现场就会去追错批次;
 * 而跳转闸门一旦只在一个入口生效(看板拦、列表不拦),就会出现"点进去空白面板"的投诉。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FLOW_PANELS, STATUS_TONE, buildSteps, jumpTarget, poText, stepState, tagTypeOf,
} from './qcFlow.js'

const ADMIN = { isAdmin: true, visiblePanels: [] }
const LIMITED = { isAdmin: false, visiblePanels: ['QC_RECV'] }

/* ── ① 单据状态档位 ── */
test('单据状态 5 档折叠成系统色:已审核绿 / 草稿蓝 / 审批中橙 / 作废红 / 未生成灰', () => {
  assert.equal(STATUS_TONE['已审核'], 'done')
  assert.equal(STATUS_TONE['草稿'], 'draft')
  assert.equal(STATUS_TONE['审批中'], 'warn')
  assert.equal(STATUS_TONE['已作废'], 'void')
  assert.equal(STATUS_TONE['已中止'], 'void')
  assert.equal(STATUS_TONE['未生成'], 'none')
})

test('el-tag 类型词与 tone 不同名:done↔success / void↔danger / draft↔primary', () => {
  assert.equal(tagTypeOf('done'), 'success')
  assert.equal(tagTypeOf('void'), 'danger')
  assert.equal(tagTypeOf('draft'), 'primary')
  assert.equal(tagTypeOf('warn'), 'warning')
  assert.equal(tagTypeOf('none'), 'info')
})

/* ── ② 节点时态 ── */
test('节点时态:有单按状态着色,无单是 todo,免检无单是 skip', () => {
  assert.equal(stepState('SL-2026-10-0001', '已审核'), 'done')
  assert.equal(stepState('SL-2026-10-0001', '草稿'), 'doing')
  assert.equal(stepState('SL-2026-10-0001', '审批中'), 'warn')
  assert.equal(stepState('SL-2026-10-0001', '已作废'), 'void')
  assert.equal(stepState('SL-2026-10-0001', '已中止'), 'void')
  assert.equal(stepState(''), 'todo')
  assert.equal(stepState(null), 'todo')
  // 免检物料:检验节点没有单据时显示「免检」而不是「未生成」
  assert.equal(stepState('', '', { skip: true }), 'skip')
  // 但一旦真的开了检验单(需检验),就照常按状态判
  assert.equal(stepState('IJ-2026-10-0020', '草稿', { skip: true }), 'doing')
})

test('一行业务数据 → 三个节点:面板码/单号/状态/日期都对上', () => {
  const row = {
    送料暂收单号: 'SL-2026-10-0119', 送料状态: '已审核', 送料日期: '2026-10-12',
    需检验: 1,
    检验单号: 'IJ-2026-10-0020', 检验状态: '草稿', 检验日期: '2026-10-13',
    入库单号: 'PI-2026-10-0116', 入库状态: '已作废', 入库日期: '2026-10-30',
  }
  const steps = buildSteps(row)
  assert.deepEqual(steps.map((s) => s.panel), [FLOW_PANELS.recv.code, FLOW_PANELS.insp.code, FLOW_PANELS.in.code])
  assert.deepEqual(steps.map((s) => s.panel), ['QC_RECV', 'QC_INSP', 'PURCHASE_IN'])
  assert.deepEqual(steps.map((s) => s.state), ['done', 'doing', 'void'])
  assert.equal(steps[0].date, '2026-10-12')
  assert.equal(steps[1].no, 'IJ-2026-10-0020')
  assert.equal(steps[1].status, '草稿')
})

test('免检批次(需检验=0 且没有检验单):检验节点显示「免检」,不是「未生成」', () => {
  const row = { 送料暂收单号: 'SL-2026-11-0001', 送料状态: '已审核', 需检验: 0 }
  const steps = buildSteps(row)
  assert.equal(steps[1].status, '免检')
  assert.equal(steps[1].state, 'skip')
  assert.equal(steps[1].tone, 'skip')
  assert.equal(steps[2].status, '未生成')
  assert.equal(steps[2].state, 'todo')
})

test('缺字段的行不炸(接口降级/老数据):三个节点仍是 todo', () => {
  const steps = buildSteps({})
  assert.equal(steps.length, 3)
  assert.deepEqual(steps.map((s) => s.state), ['todo', 'skip', 'todo'])
  assert.deepEqual(buildSteps(null).map((s) => s.state), ['todo', 'skip', 'todo'])
})

test('采购订单号:有行号时带 #N', () => {
  assert.equal(poText({ 采购订单号: 'YJ-20261012-11', 采购订单行号: '3' }), 'YJ-20261012-11 #3')
  assert.equal(poText({ 采购订单号: 'YJ-20261012-11' }), 'YJ-20261012-11')
  assert.equal(poText({}), '')
})

/* ── ③ 跳转闸门(用户口径:没有对应面板权限就无法跳转) ── */
test('跳转:有权限给出目标地址 + docNo 定位参数', () => {
  const t = jumpTarget(ADMIN, 'QC_INSP', 'IJ-2026-10-0020')
  assert.equal(t.ok, true)
  assert.equal(t.path, '/panelx/list/QC_INSP')
  assert.deepEqual(t.query, { docNo: 'IJ-2026-10-0020' })
})

test('跳转:没有该面板查看权 → ok=false 且不给地址(调用方只能提示)', () => {
  const t = jumpTarget(LIMITED, 'PURCHASE_IN', 'PI-2026-10-0116')
  assert.equal(t.ok, false)
  assert.equal(t.path, null)
  assert.equal(t.reason, 'no-permission')
  // 有权限的那个照常放行
  assert.equal(jumpTarget(LIMITED, 'QC_RECV', 'SL-2026-10-0119').ok, true)
})

test('跳转:空单号/空面板一律不跳(别把人带到列表第一张)', () => {
  assert.deepEqual(jumpTarget(ADMIN, 'QC_RECV', ''), { ok: false, path: null, query: {}, reason: 'empty' })
  assert.deepEqual(jumpTarget(ADMIN, '', 'SL-1'), { ok: false, path: null, query: {}, reason: 'empty' })
  // 拿不到用户信息(未登录/会话未还原)一律不放行
  assert.equal(jumpTarget(null, 'QC_RECV', 'SL-2026-10-0119').ok, false)
})

test('三个节点的面板码与页面菜单/后端 PagePanelRegistry 约定一致', () => {
  assert.deepEqual(Object.values(FLOW_PANELS).map((p) => p.code), ['QC_RECV', 'QC_INSP', 'PURCHASE_IN'])
  assert.deepEqual(Object.values(FLOW_PANELS).map((p) => p.name), ['送料暂收单', '来料检验单', '采购入库单'])
})
