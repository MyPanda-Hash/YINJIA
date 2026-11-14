/**
 * verify-matrix.mjs — 首件检验单「可填范围矩阵」静态校验(第十轮 2026-11-14 纸面口径)。
 *
 * 目的:不点界面也能证明 **10 列 × 8 行 = 可填 20 格 / 打 `/` 60 格**,并且与
 * `docs/design/首件检验单-可填范围.md` §一 那张表**逐格一致**;
 * 同时验证 Excel 导出(经同一判据)落出来的纸面也是 20 个值 + 60 个 `/`。
 *
 * 跑法(仓根):`node tools/archive/_first-insp-yellow-20261114/verify-matrix.mjs`
 * 退出码:0 = 全对;1 = 有格子与契约不符(会打印差异)。
 *
 * ⚠ 期望矩阵是**从契约文档抄来的硬编码**,不 import 实现里的常量 ——
 *   否则实现改了期望也跟着改,校验就失去意义。
 */
import {
  DEFAULT_TEST_ITEMS, columnsOf, groupsOf, isCheckColumn, isFillableCell, sampleRowsOf, SAMPLE_COUNT,
} from '../../../frontend/src/core/qc/firstInspCols.js'
import { buildFirstInspExport, BLANK } from '../../../frontend/src/core/qc/firstInspExport.js'

/** 契约 §一(逐格量色):key → 可填的那两行 */
const EXPECTED = {
  appearance: [1, 2], // 炭棒表观状态(勾选式)
  depowder: [1, 2],   // 炭棒脱粉情况(勾选式)
  outer: [3, 4],      // 炭棒外径
  inner: [3, 4],      // 炭棒内径
  length: [3, 4],     // 炭棒长度
  weight: [3, 4],     // 炭棒重量
  drop: [5, 6],       // 跌落 —— 纸面 5#/6#
  compress: [7, 8],   // 挤压强度 —— 纸面 7#/8#(与跌落不同对)
  turbidity: [7, 8],  // 浊度NTU(系统比纸面多的一列,随「浊度及压降」组)
  pressure: [7, 8],   // 压降kPa
}
const EXPECTED_FILLABLE = 20
const EXPECTED_BLANK = 60

const fails = []
const ok = (cond, msg) => { if (!cond) fails.push(msg) }

/* ── ① 列模型:10 列、列序 = 纸面列序 ─────────────────────────────── */
const rawCols = columnsOf(DEFAULT_TEST_ITEMS.map((d) => ({
  检验列: d.key, 检验项目: d.label, 项目分组: d.group,
})))
const columns = groupsOf(rawCols).flatMap((g) => rawCols.filter((c) => c.group === g))
const colKeys = columns.map((c) => c.key)
ok(columns.length === 10, `列数应为 10,实际 ${columns.length}`)
ok(JSON.stringify(colKeys) === JSON.stringify(Object.keys(EXPECTED)),
  `列序应与契约一致,实际 ${colKeys.join(',')}`)

/* ── ② 逐列断言:可填行 ──────────────────────────────────────────── */
for (const c of columns) {
  const got = sampleRowsOf(c)
  const want = EXPECTED[c.key]
  ok(JSON.stringify(got) === JSON.stringify(want),
    `${c.label}(${c.key}) 应可填 ${want?.join('/')},实际 ${got?.join('/')}`)
}

/* ── ③ 逐格断言:10 列 × 8 行 ───────────────────────────────────── */
let fillable = 0
let blank = 0
for (const c of columns) {
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    const want = EXPECTED[c.key].includes(s)
    const got = isFillableCell(s, c)
    if (got) fillable++
    else blank++
    ok(got === want, `${c.label} ${s}# 应为${want ? '可填' : '`/`'},实际${got ? '可填' : '`/`'}`)
  }
}
ok(fillable === EXPECTED_FILLABLE, `可填格应为 ${EXPECTED_FILLABLE},实际 ${fillable}`)
ok(blank === EXPECTED_BLANK, `占位格应为 ${EXPECTED_BLANK},实际 ${blank}`)

/* ── ④ 标准行:纸面灰底只读的是**勾选式那两列**(组件用它决定灰底 + 只读 `/`) ── */
const stdReadonlyKeys = columns.filter(isCheckColumn).map((c) => c.key)
ok(JSON.stringify(stdReadonlyKeys) === JSON.stringify(['appearance', 'depowder']),
  `标准行只读列应为 appearance/depowder,实际 ${stdReadonlyKeys.join(',')}`)

/* ── ⑤ 导出同源:每个可填格都填上值 ⇒ 纸上恰好 20 个值 + 60 个 `/` ────────── */
const items = []
let no = 0
for (const c of columns) {
  items.push({
    表区: '首件检验', 行类型: '标准', 样品序号: '标准', 检验列: c.key, 检验项目: c.label,
    项目分组: c.group, 标准: c.standard || '/', 实测数值: '', 结果判断: '', 行号: ++no,
  })
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    items.push({
      表区: '首件检验', 行类型: '样品', 样品序号: `${s}#`, 检验列: c.key, 检验项目: c.label,
      项目分组: c.group, 标准: '',
      // 每个**可填**格都填一个值;不可填格也塞值,验证导出照着纸面写 `/`(不吃历史值)
      实测数值: isFillableCell(s, c) ? `<${c.key}-${s}#>` : `历史值-${c.key}-${s}#`,
      结果判断: '', 行号: ++no,
    })
  }
}
const { aoa, marks } = buildFirstInspExport({ columns, items, requirements: [] })
let expValues = 0
let expBlanks = 0
for (const [i, c] of columns.entries()) {
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    const cell = aoa[marks.dataStart + s - 1][i + 1]
    if (isFillableCell(s, c)) {
      ok(cell === `<${c.key}-${s}#>`, `导出 ${c.label} ${s}# 应落值,实际 ${JSON.stringify(cell)}`)
      expValues++
    } else {
      ok(cell === BLANK, `导出 ${c.label} ${s}# 应写 ${BLANK},实际 ${JSON.stringify(cell)}`)
      expBlanks++
    }
  }
}
ok(expValues === EXPECTED_FILLABLE, `导出落值格应为 ${EXPECTED_FILLABLE},实际 ${expValues}`)
ok(expBlanks === EXPECTED_BLANK, `导出 \`/\` 格应为 ${EXPECTED_BLANK},实际 ${expBlanks}`)

/* ── ⑥ 打印矩阵(贴进 README 的就是这份输出) ─────────────────────── */
const pad = (s, w) => {
  const n = [...String(s)].reduce((k, ch) => k + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
  return String(s) + ' '.repeat(Math.max(0, w - n))
}
const dispW = (s) => [...String(s)].reduce((k, ch) => k + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
const W = Math.max(8, ...columns.map((c) => dispW(c.label))) + 2
console.log('\n首件检验单 可填矩阵(第十轮 2026-11-14 纸面口径)  ● = 可填(黄 #FFF3CA)   / = 打斜杠不可填\n')
console.log(pad('样品', W) + columns.map((c) => pad(c.label, W)).join(''))
for (let s = 1; s <= SAMPLE_COUNT; s++) {
  const row = columns.map((c) => pad(isFillableCell(s, c) ? '●' : '/', W)).join('')
  console.log(pad(`${s}#`, W) + row)
}
console.log(`\n合计:${columns.length} 列 × ${SAMPLE_COUNT} 行 = ${columns.length * SAMPLE_COUNT} 格`
  + ` ⇒ 可填 ${fillable} 格 / 打 \`/\` ${blank} 格`)
console.log(`标准行灰底只读列:${stdReadonlyKeys.map((k) => columns.find((c) => c.key === k).label).join('、')}`)
console.log(`导出(同源判据):落值 ${expValues} 格 / \`/\` ${expBlanks} 格`)

// Markdown 版(README 直接贴这一份)
console.log('\n复制用 Markdown 矩阵:\n')
console.log(`| 样品 \\ 测试项目 | ${columns.map((c) => c.label).join(' | ')} |`)
console.log(`| --- | ${columns.map(() => ':-:').join(' | ')} |`)
for (let s = 1; s <= SAMPLE_COUNT; s++) {
  console.log(`| ${s}# | ${columns.map((c) => (isFillableCell(s, c) ? '● 可填' : '`/`')).join(' | ')} |`)
}

/* ── ⑦ 结论 ───────────────────────────────────────────────────── */
if (fails.length) {
  console.error(`\n[FAIL] ${fails.length} 处与契约不符:`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log('\n[PASS] 10 列 × 8 行矩阵与契约 docs/design/首件检验单-可填范围.md §一 逐格一致'
  + '(可填 20 / `/` 60),导出同源。')
