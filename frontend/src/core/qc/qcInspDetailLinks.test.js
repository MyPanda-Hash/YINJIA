/**
 * 出货检验明细表单号跳转契约的单元测试(2026-11-23)。
 *
 * 用户口径:「实现点击对应的单号可以转到对应的单据」——这里钉住三件事:
 *   ① 只有明细表的「单据编号 / 工单号」两列算链接,别的列/别的面板一律不跳(免得整张报表全是下划线);
 *   ② 跳转目标逐字正确:单据编号 → /panelx/list/<出货检验单面板>?docNo=;工单号 → 生产工单页
 *      /prod/plan/workOrderList?keyword=<工单号>[&focus=<工单行id>];
 *   ③ 权限闸门:没有目标面板查看权/页面 view 词时 ok=false 且不给地址(调用方只能提示,不许硬跳);
 *      空单号一律不跳(别把人带到列表第一张)。
 *
 * 权限判定的真源是 @core/auth/panelAccess(与导航/看板/单据间跳转同一份),这里按它的入参形状构造 user。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LINK_DOC_COL,
  LINK_WO_COL,
  LINK_WO_LINE_COL,
  QC_INSP_DETAIL_PANELS,
  WORK_ORDER_ROUTE,
  detailLinkKind,
  docJumpTarget,
  isQcInspDetailPanel,
  workOrderJumpTarget,
} from './qcInspDetailLinks.js'

/** 管理员:面板权限与页面权限都放行(panelAccess 的两个判据各自认 isAdmin) */
const ADMIN = { isAdmin: true, visiblePanels: [], pagePerms: {} }
/** 普通账号:只有出货检验单 QC_ASM_INSP 的查看权 + 生产工单页的 view 词 */
const LIMITED = { isAdmin: false, visiblePanels: ['QC_ASM_INSP'], pagePerms: { WORK_ORDER_LIST: 'view,query' } }

/* ── ① 哪一列算链接 ── */
test('链接列:两张明细表的 单据编号 / 工单号 都算,其余列不跳', () => {
  for (const panel of Object.keys(QC_INSP_DETAIL_PANELS)) {
    assert.equal(detailLinkKind(panel, LINK_DOC_COL), 'doc')
    assert.equal(detailLinkKind(panel, LINK_WO_COL), 'workOrder')
    for (const other of ['工单行号', '检验项目', '客户名称', LINK_WO_LINE_COL]) {
      assert.equal(detailLinkKind(panel, other), '', `${panel}.${other} 不该是链接`)
    }
  }
})

test('链接列:非明细表面板一律不跳(同一套报表渲染器上的其它 flat 报表不受影响)', () => {
  for (const panel of ['QC_INSP_REC_DETAIL', 'WO_REPORT_LIST', 'WORK_ORDER_LIST', '', null, undefined]) {
    assert.equal(detailLinkKind(panel, LINK_DOC_COL), '')
    assert.equal(detailLinkKind(panel, LINK_WO_COL), '')
    assert.equal(isQcInspDetailPanel(panel), false)
  }
  assert.equal(isQcInspDetailPanel('QC_PROC_INSP_DETAIL'), true)
  assert.equal(isQcInspDetailPanel('QC_ASM_INSP_DETAIL'), true)
})

/* ── ② 单据编号 → 出货检验单 ── */
test('单据编号:表观明细 → QC_ASM_INSP,功能明细 → QC_PROC_INSP,带 ?docNo= 定位', () => {
  const asm = docJumpTarget(ADMIN, 'QC_ASM_INSP_DETAIL', 'ZJ-2026-11-0011')
  assert.equal(asm.ok, true)
  assert.equal(asm.path, '/panelx/list/QC_ASM_INSP')
  assert.deepEqual(asm.query, { docNo: 'ZJ-2026-11-0011' })
  assert.equal(asm.panel, 'QC_ASM_INSP')

  const proc = docJumpTarget(ADMIN, 'QC_PROC_INSP_DETAIL', 'ZC-2026-11-0014')
  assert.equal(proc.path, '/panelx/list/QC_PROC_INSP')
  assert.deepEqual(proc.query, { docNo: 'ZC-2026-11-0014' })
})

test('单据编号:空单号/未知面板不跳(不给地址,避免落到列表第一张)', () => {
  assert.equal(docJumpTarget(ADMIN, 'QC_ASM_INSP_DETAIL', '').ok, false)
  assert.equal(docJumpTarget(ADMIN, 'QC_ASM_INSP_DETAIL', '   ').path, null)
  assert.equal(docJumpTarget(ADMIN, 'QC_ASM_INSP_DETAIL', null).reason, 'empty')
  assert.equal(docJumpTarget(ADMIN, 'QC_INSP_REC_DETAIL', 'ZJ-1').reason, 'unknown-panel')
  assert.equal(docJumpTarget(ADMIN, 'QC_INSP_REC_DETAIL', 'ZJ-1').path, null)
})

test('单据编号:没有该出货检验单面板查看权 → ok=false 且不给地址', () => {
  const r = docJumpTarget(LIMITED, 'QC_PROC_INSP_DETAIL', 'ZC-2026-11-0014')
  assert.equal(r.ok, false)
  assert.equal(r.path, null)
  assert.equal(r.reason, 'no-permission')
  // 有权限的那张照旧放行
  assert.equal(docJumpTarget(LIMITED, 'QC_ASM_INSP_DETAIL', 'ZJ-2026-11-0011').ok, true)
  // 拿不到用户信息 = 不放行(panelAccess 的口径)
  assert.equal(docJumpTarget(null, 'QC_ASM_INSP_DETAIL', 'ZJ-1').ok, false)
})

/* ── ③ 工单号 → 生产工单页 ── */
test('工单号:带工单行id → keyword + focus(工单页据此定位该行并打开追溯)', () => {
  const r = workOrderJumpTarget(ADMIN, 'GD-2026-11-0028', 3209)
  assert.equal(r.ok, true)
  assert.equal(r.path, WORK_ORDER_ROUTE)
  assert.deepEqual(r.query, { keyword: 'GD-2026-11-0028', focus: '3209' })
})

test('工单号:工单行id 为空(对不上 plang 行) → 只带 keyword,仍能跳到那张工单', () => {
  for (const id of [null, undefined, '', '   ']) {
    const r = workOrderJumpTarget(ADMIN, 'GD-2026-11-0028', id)
    assert.equal(r.ok, true)
    assert.deepEqual(r.query, { keyword: 'GD-2026-11-0028' }, `lineId=${JSON.stringify(id)}`)
  }
})

test('工单号:空工单号不跳;没有生产工单页 view 词 → ok=false 且不给地址', () => {
  assert.equal(workOrderJumpTarget(ADMIN, '', 1).reason, 'empty')
  assert.equal(workOrderJumpTarget(ADMIN, '', 1).path, null)

  const noPerm = { isAdmin: false, pagePerms: { WORK_ORDER_LIST: 'create,del' } }
  const r = workOrderJumpTarget(noPerm, 'GD-2026-11-0028', 3209)
  assert.equal(r.ok, false)
  assert.equal(r.path, null)
  assert.equal(r.reason, 'no-permission')
  // pagePerms 里没有这个页面 = 同样不放行
  assert.equal(workOrderJumpTarget({ isAdmin: false, pagePerms: {} }, 'GD-1', 1).ok, false)
  // '*' 通配词(后端下发的全权)照旧放行
  assert.equal(workOrderJumpTarget({ isAdmin: false, pagePerms: { WORK_ORDER_LIST: '*' } }, 'GD-1', 1).ok, true)
})
