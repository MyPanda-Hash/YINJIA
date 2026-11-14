/**
 * _c5-matrix.mjs — 验收者独立复核(2026-11-14):三处「可填矩阵」与契约 §一 逐格一致。
 *
 * 期望值**手工从契约文档抄写**(不 import 实现里的常量/不 import 实现任务的校验脚本),
 * 只 import 三个被测实现:
 *   1) frontend/src/core/qc/firstInspCols.js        (sampleRowsOf / isFillableCell / isCheckColumn)
 *   2) frontend/src/core/qc/firstInspExport.js      (buildFirstInspExport: 非可填格写 `/`)
 *   3) 服务端 PDF 文本(xlsx 与 PDF 产物由 A3/A4 步骤另行落盘;此处只跑前两处 +
 *      把 A4 服务端 PDF 文本里的「值落在哪一列」作为第三处一致性证据,由 README 引用)
 *
 * 跑法(仓根):node tools/archive/_verify-20261114/_c5-matrix.mjs
 */
import {
  DEFAULT_TEST_ITEMS, columnsOf, groupsOf, isCheckColumn, isFillableCell, sampleRowsOf, SAMPLE_COUNT,
} from '../../../frontend/src/core/qc/firstInspCols.js'
import { buildFirstInspExport, BLANK } from '../../../frontend/src/core/qc/firstInspExport.js'

/* —— 契约 docs/design/首件检验单-可填范围.md §一(2026-11-14 第十轮) —— */
const CONTRACT = [
  { label: '炭棒表观状态', rows: [1, 2] },
  { label: '炭棒脱粉情况', rows: [1, 2] },
  { label: '炭棒外径', rows: [3, 4] },
  { label: '炭棒内径', rows: [3, 4] },
  { label: '炭棒长度', rows: [3, 4] },
  { label: '炭棒重量', rows: [3, 4] },
  { label: '跌落', rows: [5, 6] },
  { label: '挤压强度', rows: [5, 6] },
  { label: '浊度NTU', rows: [7, 8] },
  { label: '压降kPa', rows: [7, 8] },
]
const fails = []
const ok = (c, m) => { if (!c) fails.push(m) }

/* ① 列模型:10 列、列序与契约一致 */
const raw = columnsOf(DEFAULT_TEST_ITEMS.map((d) => ({ 检验列: d.key, 检验项目: d.label, 项目分组: d.group })))
const cols = groupsOf(raw).flatMap((g) => raw.filter((c) => c.group === g))
ok(cols.length === 10, `列数 10? 实际 ${cols.length}`)
cols.forEach((c, i) => {
  const want = CONTRACT[i]
  ok(c.label === want.label, `列[${i + 1}] 名 ${want.label}? 实际 ${c.label}`)
  ok(JSON.stringify(sampleRowsOf(c)) === JSON.stringify(want.rows), `${c.label} 可填行 ${want.rows.join('/')}? 实际 ${sampleRowsOf(c).join('/')}`)
})

/* ② 逐格:10×8 = 80,可填 20 / `/` 60 */
let fill = 0
let blank = 0
for (const [i, c] of cols.entries()) {
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    const want = CONTRACT[i].rows.includes(s)
    ok(isFillableCell(s, c) === want, `${c.label} ${s}# 应${want ? '可填' : '不可填'}`)
    if (want) fill++; else blank++
  }
}
ok(fill === 20, `可填合计 20? 实际 ${fill}`)
ok(blank === 60, `斜杠格合计 60? 实际 ${blank}`)

/* ③ 标准行灰底只读列 = 勾选式两列(表观/脱粉) */
const stdKeys = cols.filter(isCheckColumn).map((c) => c.label)
ok(JSON.stringify(stdKeys) === JSON.stringify(['炭棒表观状态', '炭棒脱粉情况']), `标准行只读列 ${stdKeys.join('/')}`)

/* ④ Excel 导出同源:可填格落值、不可填格一律 `/` —— 每格塞不同值,验证不吃历史值 */
const items = []
let no = 0
for (const c of cols) {
  items.push({ 表区: '首件检验', 行类型: '标准', 样品序号: '标准', 检验列: c.key, 检验项目: c.label, 项目分组: c.group, 标准: c.standard || '/', 实测数值: '', 结果判断: '', 行号: ++no })
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    items.push({ 表区: '首件检验', 行类型: '样品', 样品序号: `${s}#`, 检验列: c.key, 检验项目: c.label, 项目分组: c.group, 标准: '', 实测数值: `V${c.key}${s}`, 结果判断: '', 行号: ++no })
  }
}
const { aoa, marks } = buildFirstInspExport({ columns: cols, items, requirements: [] })
let exFill = 0
let exBlank = 0
for (const [i, c] of cols.entries()) {
  for (let s = 1; s <= SAMPLE_COUNT; s++) {
    const cell = aoa[marks.dataStart + s - 1][i + 1]
    if (CONTRACT[i].rows.includes(s)) {
      ok(cell === `V${c.key}${s}`, `导出 ${c.label} ${s}# 落值? 实际 ${JSON.stringify(cell)}`)
      exFill++
    } else {
      ok(cell === BLANK, `导出 ${c.label} ${s}# 应 ${BLANK}? 实际 ${JSON.stringify(cell)}`)
      exBlank++
    }
  }
}
ok(exFill === 20, `导出入值 20? 实际 ${exFill}`)
ok(exBlank === 60, `导出 ${BLANK} 格 60? 实际 ${exBlank}`)

/* ⑤ 输出 */
const pad = (s, w) => { const n = [...String(s)].reduce((k, ch) => k + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0); return String(s) + ' '.repeat(Math.max(0, w - n)) }
const W = 14
console.log('契约矩阵(frontend 实测): ●=可填  /=不可填')
console.log(pad('样品', 8) + cols.map((c) => pad(c.label, W)).join(''))
for (let s = 1; s <= SAMPLE_COUNT; s++) {
  console.log(pad(`${s}#`, 8) + cols.map((c) => pad(isFillableCell(s, c) ? '●' : '/', W)).join(''))
}
console.log(`可填 ${fill} / 不可填 ${blank} / 导出落值 ${exFill} / 导出 ${BLANK} ${exBlank}`)
if (fails.length) {
  console.error(`[FAIL] ${fails.length} 处与契约不符:`)
  fails.slice(0, 40).forEach((f) => console.error('  - ' + f))
  process.exit(1)
}
console.log('[PASS] frontend 列模型 + Excel 导出与契约 §一 逐格一致(可填 20 / 斜杠 60)')
