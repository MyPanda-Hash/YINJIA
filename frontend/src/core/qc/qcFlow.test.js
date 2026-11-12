/**
 * qcFlow 单测 —— 「品质流程监控」(QC_FLOW)的纯判定:
 *   ① 单据状态 → 展示档位(与后端 QcFlowService 的 5 档折叠一一对应);
 *   ② 一行业务数据 → 主链(送料/检验/入库)+ 不合格分支(退回/特采)的时态与"该不该显示分支";
 *   ③ 跳转前的能力判定 —— **没有目标面板查看权就不能跳**(用户 2026-11-12 原话);
 *   ④ 隐藏口径(已转ERP)由后端算,前端只认 已隐藏 标记做提示(这里钉住不误读)。
 *
 * 为什么要钉这些:看板上的几种"看起来差不多"的灰/彩色节点,分别代表
 * 「还没生成单据」「免检跳过」「作废」,判定错一处现场就会去追错批次;
 * 而跳转闸门一旦只在一个入口生效(看板拦、列表不拦),就会出现"点进去空白面板"的投诉。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FLOW_PANELS, STATUS_TONE, buildChain, jumpTarget, makeNode, poText, stepState, tagTypeOf,
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
  assert.equal(stepState('', '', { skip: true }), 'skip')
  assert.equal(stepState('IJ-2026-10-0020', '草稿', { skip: true }), 'doing')
})

test('一行业务数据 → 主链三个节点:面板码/单号/状态/日期都对上', () => {
  const row = {
    送料暂收单号: 'SL-2026-10-0119', 送料状态: '已审核', 送料日期: '2026-10-12',
    需检验: 1,
    检验单号: 'IJ-2026-10-0020', 检验状态: '草稿', 检验日期: '2026-10-13',
    入库单号: 'PI-2026-10-0116', 入库状态: '已作废', 入库日期: '2026-10-30',
  }
  const chain = buildChain(row)
  assert.deepEqual(chain.main.map((s) => s.panel), ['QC_RECV', 'QC_INSP', 'PURCHASE_IN'])
  assert.deepEqual(chain.main.map((s) => s.state), ['done', 'doing', 'void'])
  assert.equal(chain.main[0].date, '2026-10-12')
  assert.equal(chain.main[1].no, 'IJ-2026-10-0020')
  assert.equal(chain.main[1].status, '草稿')
})

test('免检批次(需检验=0 且没有检验单):检验节点显示「免检」,不是「未生成」', () => {
  const chain = buildChain({ 送料暂收单号: 'SL-2026-11-0001', 送料状态: '已审核', 需检验: 0 })
  const insp = chain.main[1]
  assert.equal(insp.status, '免检')
  assert.equal(insp.state, 'skip')
  assert.equal(insp.tone, 'skip')
  assert.equal(chain.main[2].status, '未生成')
  assert.equal(chain.main[2].state, 'todo')
})

test('缺字段的行不炸(接口降级/老数据):主链仍是 todo,分支不显示', () => {
  const chain = buildChain({})
  assert.equal(chain.main.length, 3)
  assert.deepEqual(chain.main.map((s) => s.state), ['todo', 'skip', 'todo'])
  assert.equal(chain.showNg, false)
  assert.deepEqual(buildChain(null).main.map((s) => s.state), ['todo', 'skip', 'todo'])
})

/* ── ②b 不合格分支(2026-11-12 第二轮:检验→退货→特采→入库) ── */
test('不合格分支:有退回单/特采单时显示,节点各自带状态与面板码', () => {
  const chain = buildChain({
    需检验: 1,
    送料暂收单号: 'SL-2026-10-0085', 送料状态: '已审核',
    检验单号: 'IJ-2026-10-0030', 检验状态: '已审核', 合格数量: 0, 不合格数量: 100, 检验结论: '不合格',
    退货单号: 'TH-2026-10-0007', 退货状态: '已审核', 退货日期: '2026-10-21',
    特采单号: 'TCI-2026-10-0003', 特采状态: '审批中', 特采日期: '2026-10-22',
  })
  assert.equal(chain.showNg, true)
  assert.deepEqual(chain.ng.map((n) => n.panel), ['QC_RETURN', 'QC_TC_IN'])
  assert.deepEqual(chain.ng.map((n) => n.state), ['done', 'warn'])
  assert.equal(chain.ng[0].no, 'TH-2026-10-0007')
  assert.equal(chain.ng[1].status, '审批中')
})

test('不合格分支:检验判了不合格但还没开退回单 → 分支显示两个「未生成」待办', () => {
  const chain = buildChain({
    需检验: 1, 送料暂收单号: 'SL-1', 送料状态: '已审核',
    检验单号: 'IJ-1', 检验状态: '已审核', 检验结论: '不合格',
  })
  assert.equal(chain.showNg, true)
  assert.deepEqual(chain.ng.map((n) => n.state), ['todo', 'todo'])
  assert.deepEqual(chain.ng.map((n) => n.status), ['未生成', '未生成'])
})

test('全合格批次不显示不合格分支(不占版面)', () => {
  const chain = buildChain({
    需检验: 1, 送料暂收单号: 'SL-1', 送料状态: '已审核',
    检验单号: 'IJ-1', 检验状态: '已审核', 合格数量: 100, 不合格数量: 0, 检验结论: '合格',
  })
  assert.equal(chain.showNg, false)
})

test('部分不合格:分支照样显示(要人去看那部分不良怎么处置)', () => {
  const chain = buildChain({
    需检验: 1, 检验单号: 'IJ-1', 检验状态: '已审核',
    合格数量: 60, 不合格数量: 40, 检验结论: '部分不合格',
  })
  assert.equal(chain.showNg, true)
})

test('makeNode 的 skip 只在没有单号时生效(有单就按真实状态显示)', () => {
  assert.equal(makeNode('insp', '', '', '', { skip: true }).status, '免检')
  assert.equal(makeNode('insp', 'IJ-1', '审批中', '', { skip: true }).status, '审批中')
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
  assert.equal(jumpTarget(LIMITED, 'QC_RECV', 'SL-2026-10-0119').ok, true)
  // 不合格分支的两个面板同样要过闸门
  assert.equal(jumpTarget(LIMITED, 'QC_RETURN', 'TH-1').ok, false)
  assert.equal(jumpTarget(LIMITED, 'QC_TC_IN', 'TCI-1').ok, false)
})

test('跳转:空单号/空面板一律不跳(别把人带到列表第一张)', () => {
  assert.deepEqual(jumpTarget(ADMIN, 'QC_RECV', ''), { ok: false, path: null, query: {}, reason: 'empty' })
  assert.deepEqual(jumpTarget(ADMIN, '', 'SL-1'), { ok: false, path: null, query: {}, reason: 'empty' })
  assert.equal(jumpTarget(null, 'QC_RECV', 'SL-2026-10-0119').ok, false)
})

test('五个节点的面板码与页面菜单/后端 PagePanelRegistry 约定一致', () => {
  assert.deepEqual(Object.values(FLOW_PANELS).map((p) => p.code),
    ['QC_RECV', 'QC_INSP', 'PURCHASE_IN', 'QC_RETURN', 'QC_TC_IN'])
  assert.deepEqual(Object.values(FLOW_PANELS).map((p) => p.name),
    ['送料暂收单', '来料检验单', '采购入库单', '暂收退回单', '特采单'])
})

/* ── ④ 隐藏口径(后端算 已隐藏,前端只做提示,不影响节点可点) ── */
test('已隐藏(已转ERP)的行:节点照常可点、可跳 — 隐藏只是"默认不显示"', () => {
  const row = {
    需检验: 0, 送料暂收单号: 'SL-1', 送料状态: '已审核',
    入库单号: 'PI-1', 入库状态: '已审核', 入库已转ERP: '是', 已隐藏: 1,
  }
  const chain = buildChain(row)
  assert.equal(chain.main[2].no, 'PI-1')
  assert.equal(chain.main[2].state, 'done')
  assert.equal(jumpTarget(ADMIN, chain.main[2].panel, chain.main[2].no).ok, true)
})
