/**
 * recordSheetConfigs 纸面「外：/内：/长：」前缀退役单测 —— 2026-11-06
 *
 * 【为什么必须自动化守】
 * 烧结工艺清单(RD_MOLD_PROC,纸面名「炭棒工艺管控清单」)页 0「产品基本信息」的「炭棒规格」
 * 是三窄格(炭棒规格1/2/3)。历史上这三格在纸上带 `外：` / `内：` / `长：` 前缀,分两步退役:
 *
 *   ① 2026-11-03(用户报障「服务器上的烧结工艺清单导进来的炭棒规格带文字,导致后续计算有问题」)
 *      ⇒ **数据**改存裸数字,前缀只由纸面渲染(`cell.pre`);落格口径见 core/panel/carbonSpec.js;
 *   ② 2026-11-06(用户报障原话「研发管理的烧结工艺清单的炭棒规格的外：、内：、长：,
 *      这些表格内背景词去掉」)⇒ **纸面**也不再渲染这三个前缀,三格只剩数字输入框。
 *
 * 两条不变量,任一条破了都回到"格子里带文字":
 *   1. 任何面板的纸面配置都不得再给格子配 `外：/内：/长：` 前缀(否则那三个灰字又出现,
 *      录入/导入的人会以为要连文字一起填 —— 那正是 ① 出事的原因);
 *   2. 三格本身**不能顺手删**:`炭棒规格1/2/3` 是「选产品编号」回填(carbonSpec.js)与历史
 *      单据读值的数据键,格没了就是整行空白 + 保存静默丢值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/** 退役的纸面前缀(全角/半角冒号都算命中) */
const RETIRED_PREFIX = /^(外|内|长)\s*[：:]$/

/** 遍历一张面板配置里所有「格子」(sections/tailSections 的 rows[].grid[] / pairs[],dataTables 的 cols[]) */
function* eachCell(cfg) {
  for (const group of ['sections', 'tailSections']) {
    for (const sec of cfg[group] || []) {
      for (const row of sec.rows || []) {
        for (const c of row.grid || []) yield { where: `${group}/${sec.bar}`, cell: c }
        for (const c of row.pairs || []) yield { where: `${group}/${sec.bar}`, cell: c }
        // pair 的多值格(cells[])也是纸面格子
        for (const c of row.pairs || []) for (const sub of c.cells || []) yield { where: `${group}/${sec.bar}`, cell: sub }
      }
    }
  }
  for (const dt of cfg.dataTables || []) {
    for (const c of dt.cols || []) yield { where: `dataTables/${dt.title || dt.key || dt.filterVal || '表'}`, cell: c }
  }
}

test('纸面配置里不再出现「外：/内：/长：」前缀(2026-11-06 用户口径:三格只要数字)', () => {
  const hits = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    for (const { where, cell } of eachCell(cfg)) {
      if (cell && typeof cell.pre === 'string' && RETIRED_PREFIX.test(cell.pre.trim())) {
        hits.push(`${panel} · ${where} · ${cell.key || cell.label || '?'} → pre「${cell.pre}」`)
      }
    }
  }
  assert.deepEqual(hits, [], `这些格子又带上炭棒规格纸面前缀了(去掉 cell.pre 即可):\n${hits.join('\n')}`)
})

test('烧结工艺清单页 0「产品基本信息」:炭棒规格三格仍在,顺序 1/2/3,且不带前缀与提示词', () => {
  const cfg = recordSheetConfigs.RD_MOLD_PROC
  assert.ok(cfg, 'RD_MOLD_PROC 配置不存在')

  const sec = (cfg.sections || []).find((s) => s.bar === '产品基本信息' && (s.page ?? 0) === 0)
  assert.ok(sec, 'RD_MOLD_PROC 页 0 找不到「产品基本信息」区块')

  // 值行 = 带 key 的那一行(标签行只有 label)
  const valueRow = (sec.rows || []).find((r) => (r.grid || []).some((c) => c.key))
  assert.ok(valueRow, '「产品基本信息」没有值行')

  const specCells = valueRow.grid.filter((c) => /^炭棒规格[123]$/.test(String(c.key || '')))
  assert.deepEqual(
    specCells.map((c) => c.key),
    ['炭棒规格1', '炭棒规格2', '炭棒规格3'],
    '三格的键与顺序被改动了 —— 这三个键是回填(carbonSpec.js)与历史单据读值的数据键',
  )
  for (const c of specCells) {
    assert.equal(c.pre, undefined, `${c.key} 还带纸面前缀「${c.pre}」`)
    assert.equal(c.ph, undefined, `${c.key} 还带提示词「${c.ph}」(用户口径:导入只有数字)`)
  }
})
