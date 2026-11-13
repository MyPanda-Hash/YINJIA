/**
 * revisionSheetFixedRows.test.js — 「修订记录」页签预设固定行数(用户口径 2026-11-11)
 *
 * 【用户原话】
 *   「这个面板（出货检验计划表）也加一个修订记录 tap 页，**所有的修订记录 tap 页都要预先设置符合
 *     A4 打印的行数**，而不是要自己一个一个去加，这个是固定下来，没有数据填写就表格空着」。
 *
 * 【为什么这条需要专门的钉子】
 *   仓库里「预铺空行」有两个易混开关，且**行数与隐藏按钮是两件事**：
 *     · `blankRows: N`  —— 按表预铺 N 行空行（RecordSheetPanels 的 watch，只在本表区为空时铺一次）；
 *     · `fixedRows: true` —— **布尔**，只隐藏 ＋/× 与底部「新增数据记录行」，**一行动都不会多出来**。
 *   2026-10-30 就把 `fixedRows: 10` 当行数用过（后果：按钮没了、行也没多）。
 *   修订记录页要的是"固定 N 行、无数据也留空、不给手工加行" ⇒ 两个开关**都要给**。
 *
 * 【A4 行数怎么定】按各页自己的 design.rowH(磅值×4/3)与 A4 可用高度倒算，
 *   各页行高不同(43/43/50…)，所以**不能全库统一一个数**，只能逐页声明并在此登记。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const cfg = read('src/core/views/recordSheetConfigs.js')
const panel = read('src/core/views/RecordSheetPanels.vue')

/** 取出某个 `const NAME = { ... }` 到下一个顶层 `\n}` 的代码块（够用：这些常量都不嵌套同形块） */
function blockOf(name) {
  const at = cfg.indexOf(`const ${name} = {`)
  assert.ok(at > 0, `找不到常量 ${name}`)
  const end = cfg.indexOf('\n}', at)
  return cfg.slice(at, end)
}

test('① 每一处 sheet 配置里的「修订记录」表都声明了 blankRows + fixedRows', () => {
  // 所有带 filterVal:'修订记录' 或 pageTitle:'修订记录' 的表块
  const revBlocks = []
  const re = /pageTitle: '修订记录'/g
  let m
  while ((m = re.exec(cfg))) {
    // 向前找到该块的开头 `{ page:`/`{ bar:`，向后找到配平的 `}` 之前 1200 字符作为样本
    revBlocks.push(cfg.slice(Math.max(0, m.index - 300), m.index + 1200))
  }
  assert.ok(revBlocks.length >= 3, `修订记录表只找到 ${revBlocks.length} 处，应有组装/成型/规格书≥3 处`)
  for (const b of revBlocks) {
    assert.match(b, /blankRows:\s*\d+/, '有修订记录表没声明 blankRows ⇒ 不会预铺固定行')
    assert.match(b, /fixedRows:\s*true/, '有修订记录表没声明 fixedRows:true ⇒ 还会出现「＋ 新增数据记录行」')
  }
})

test('② 行数是"符合 A4 打印"的具体数字，不是占位 0', () => {
  const nums = [...cfg.matchAll(/pageTitle: '修订记录'[\s\S]{0,900}?blankRows:\s*(\d+)/g)].map((x) => Number(x[1]))
  assert.ok(nums.length >= 3, `解析到 ${nums.length} 个修订记录行数，应 ≥3`)
  for (const n of nums) {
    assert.ok(n >= 5 && n <= 30, `修订记录行数 ${n} 不合理（A4 单页应在 5~30 行之间）`)
  }
})

test('③ fixedRows 的语义在组件里没被当成"行数"用(防再犯 2026-10-30 的错)', () => {
  // fixedRows 只该出现在"隐藏增减按钮"的位置
  assert.match(panel, /v-if="editable && !dt\.fixedRows"/, 'fixedRows 应只用于隐藏 ＋/× 与底部新增行')
  // 且不能出现 `blankRows = dt.fixedRows` 这类把布尔当数字的写法
  assert.ok(!/blankRows[^\n]{0,40}dt\.fixedRows/.test(panel),
    'fixedRows 是布尔，不能当行数赋给 blankRows')
})

test('④ 出货检验计划表(RD_INSP_PLAN)新增「修订记录」页签', () => {
  const at = cfg.indexOf('RD_INSP_PLAN: {')
  assert.ok(at > 0, '找不到 RD_INSP_PLAN')
  const blk = cfg.slice(at, at + 30000)
  assert.match(blk, /pages:\s*\[/, 'RD_INSP_PLAN 仍是单页（没有 pages 数组）⇒ 出不了页签')
  assert.match(blk, /修订记录/, 'RD_INSP_PLAN 没有修订记录页')
  // 修订记录页必须有自己能分块的行标识(本面板 rd_insp_plan_detail **没有 [表区] 物理列**)
  assert.match(blk, /filterKey|sheetArea|表区/, 'RD_INSP_PLAN 修订记录页缺分块键（该行表没有 [表区] 列，必须另用一列）')
})
