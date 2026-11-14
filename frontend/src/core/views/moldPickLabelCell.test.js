/**
 * moldPickLabelCell.test.js — 烧结工艺单「选型号」位置调整(用户口径 2026-11-11)
 *
 * 【用户原话】「工艺单-烧结的炭棒选型号选项挪开位置，可以放到炭棒尺寸下面（打印时不要显示）」。
 *
 * 【改前】`{ key: '外径mm', span: 2, moldPick: true }` —— 下拉渲染在**数据格**里，
 *   占着「炭棒外径mm」那一列的输入位置(截图里就是那个"选型号（按生..."的框)，
 *   用户要的炭棒外径值反而没地方显眼地填。
 * 【改后】下拉挂到「炭棒尺寸」这个 rowspan=2 的**标签格**里(标签文字下方)，
 *   四个数据格恢复成普通输入框;打印时空着的那一格不出现下拉。
 *
 * 【为什么必须钉「打印不显示」】改前 `.rs-mold-pick` 没有 no-print 类 ⇒ 盖章打印时
 *   纸面上的"选型号（按生产车间筛）"是可见的。—— 用户明确要求打印不出现。
 *
 * 与仓库既有做法一致:本仓库前端只有 node --test(无组件挂载环境),
 *   这类"接线型"改动按源码断言钉住(同 sinterFlowFixes.test.js ④)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const cfg = read('src/core/views/recordSheetConfigs.js')
const panel = read('src/core/views/RecordSheetPanels.vue')

test('① 选型号挂在「炭棒尺寸」标签格上(不是外径mm 数据格)', () => {
  assert.match(cfg, /label: '炭棒尺寸'[^}]*moldPick: true/,
    '「炭棒尺寸」标签格必须声明 moldPick: true（下拉放标签下面）')
  assert.ok(!/\{ key: '外径mm', span: 2, moldPick: true \}/.test(cfg),
    '外径mm 数据格不该再是 mouldPick 格（下拉已挪到标签格）')
})

test('② 四个尺寸数据格仍在同一行、仍是可填格', () => {
  const at = cfg.indexOf("{ key: '外径mm', span: 2 }")
  assert.ok(at > 0, '外径mm 必须恢复为普通数据格 { key: \'外径mm\', span: 2 }')
  const row = cfg.slice(at, at + 200)
  for (const k of ['外径公差', '内径mm', '内径公差']) assert.ok(row.includes(k), `四格必须同行:${k}`)
})

test('③ 标签格真的渲染了下拉(两处表格分支都要有)', () => {
  // RecordSheetPanels 有两段 <table v-for="(sec, si) in cfg.sections">(表格锚点前后各一段),
  // 只改一段会让另一页的标签格没有下拉 —— 必须两段都渲染。
  const labelCellBlocks = panel.split('class="rs-td rs-label"').slice(1)
  const withPick = labelCellBlocks.filter((b) => b.slice(0, 900).includes('c.moldPick'))
  assert.ok(withPick.length >= 2,
    `两段 table 的标签格都要渲染型号下拉，实际只有 ${withPick.length} 段`)
})

test('④ 打印时下拉不出现(no-print + 打印规则双保险)', () => {
  const at = panel.indexOf('class="rs-mold-pick')
  assert.ok(at > 0, '找不到 .rs-mold-pick 容器')
  assert.match(panel.slice(Math.max(0, at - 200), at + 60), /no-print/,
    '下拉容器必须带 no-print 类')
  // 两条打印路径:浏览器直接 Ctrl+P(@media print) 与 按钮打印(body.approval-printing)
  assert.match(panel, /@media print \{[^}]*\.no-print/, '@media print 要隐藏 .no-print')
  assert.match(panel, /body\.approval-printing[^{]*\{[^}]*\.rs-mold-pick|body\.approval-printing \.rs-mold-pick/,
    'approval-printing 打印路径也要隐藏 .rs-mold-pick')
})

test('⑤ 型号候选/回填逻辑未被动过(仍按生产车间筛、仍一次填四格)', () => {
  assert.match(panel, /const moldRowsInWorkshop = computed\(\(\) => sinterRowsForWorkshop\(/)
  assert.match(panel, /function applyMoldModel/)
  assert.match(panel, /sinterPatch\(row\)/)
  assert.match(panel, /panelCode: 'PROD_MOLD'/)
})
