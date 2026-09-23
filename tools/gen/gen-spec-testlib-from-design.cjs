/**
 * gen-spec-testlib-from-design.cjs — 按设计《规格书细分.xlsx》「检验项目及标准」重建规格书检验标准库
 *
 * 用户口径(2026-09-20):原有标准库内容**全删**,改按该 sheet 重写为 **18 个检验项目**;
 * 每个项目内部的多行(合并单元格表达的子行)保留 —— 例如「炭棒尺寸」展开为外径/内径/长度 三行要求。
 *
 * 数据结构(与库现有形态一致):
 *   { name: 组名, subs: [{ name: 子项名, req: 检验要求, method: 检验方法, basis: 检验依据 }] }
 *
 * 解析规则(照 sheet 的合并结构):
 *   · B 列 = 序号(1..18);序号变化 = 新组(18 个检验项目)
 *   · C 列 = 检验项目(组名);C 被合并时取合并区左上值
 *   · D 列 = 子项名。D 与 C 同值(即 C:D 合并)= 单子项组 ⇒ 子项名留空。
 *     同一组内 D 合并跨行时后续行的 D 回落左上值,此时:
 *       · 该行 E 与上一行相同 ⇒ 是同一子项的续行(把 F 追加到该方法)
 *       · 该行 E 不同         ⇒ 是**新的子行**,另起一个 sub(名字沿用 D,单子项组留空)
 *   · E = 检验要求、F = 检验方法、G = 检验依据。
 *
 * ⚠ 合并区回落会**重复**给出同一个值(同一个「银嘉测试标准」在合并区每行都回落一次),
 *   故 req/method/basis 一律**去重追加**:值相同不重复拼,值不同才换行追加
 *   (这样「黑水」那种 "1.… / 2.…" 两行方法仍能正确拼成两行)。
 *
 * ⚠ 先输出到 stdout 供人工核对;加 --write 才落到 specTestLib.js。
 *
 * 用法:node tools/gen/gen-spec-testlib-from-design.cjs [--write]
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const XLSX = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'xlsx'))

const FILE = 'C:/Users/x1787/OneDrive/Desktop/产品开发/产品开发/2.产品文件/2.1规格书/规格书细分.xlsx'
const SHEET = '检验项目及标准'
const WRITE = process.argv.includes('--write')

const wb = XLSX.readFile(FILE, { cellDates: true })
const ws = wb.Sheets[SHEET]
if (!ws) { console.error('✗ 找不到 sheet:', SHEET); process.exit(1) }

const range = XLSX.utils.decode_range(ws['!ref'])
const merges = ws['!merges'] || []

/** 取单元格值;若处于合并区且非左上角,回落左上角 */
function valOf(r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  if (cell && cell.v !== undefined && cell.v !== '') return String(cell.v)
  const m = merges.find((mm) => r >= mm.s.r && r <= mm.e.r && c >= mm.s.c && c <= mm.e.c)
  if (m) {
    const tl = ws[XLSX.utils.encode_cell(m.s)]
    if (tl && tl.v !== undefined) return String(tl.v)
  }
  return ''
}
/** 该格是否为所在合并区的**起始格**(非合并格也算起始)。用于区分"新的子行"与"同一子行的续行" */
function isBlockStart(r, c) {
  const m = merges.find((mm) => r >= mm.s.r && r <= mm.e.r && c >= mm.s.c && c <= mm.e.c)
  return !m || (m.s.r === r && m.s.c === c)
}
const norm = (s) => String(s || '').replace(/\r/g, '').trim()
/** 去重追加:新值与已有任一整行相同则不加(合并区回落会产生同值重复) */
function appendDedup(cur, add) {
  if (!add) return cur
  const parts = cur ? cur.split('\n') : []
  if (parts.includes(add)) return cur
  return cur ? cur + '\n' + add : add
}

const groups = []
let curGroup = null
let curSub = null
let lastSeq = null

for (let r = range.s.r; r <= range.e.r; r++) {
  const B = norm(valOf(r, 1))
  const C = norm(valOf(r, 2))
  const D = norm(valOf(r, 3))
  const E = norm(valOf(r, 4))
  const F = norm(valOf(r, 5))
  const G = norm(valOf(r, 6))

  if (!B || !/^\d+$/.test(B)) continue
  const seqNum = Number(B)
  if (seqNum < 1 || seqNum > 18) continue

  if (seqNum !== lastSeq) {
    lastSeq = seqNum
    curGroup = { seq: seqNum, name: C, subs: [] }
    groups.push(curGroup)
    curSub = null
  }
  if (!curGroup) continue

  // 子项名:D 与 C 同值(单子项组)⇒ 留空
  const subName = D === C ? '' : D
  // 是否另起子项 —— 组合判断(设计用合并+留空表达"这些行同属一个子项"):
  //   ① 还没有当前子项                        ⇒ 是
  //   ② D 列**换了新值**(且非空)              ⇒ 是(新子项,如 重量:炭棒重量 → *出货重量)
  //   ③ 本行 E 与当前子项已收的 E **不同**      ⇒ 是(设计的"子行":炭棒尺寸 外径/内径/长度
  //      三行虽然 D 合并成同一格,却是三条**独立要求**,必须各占一子项;E 相同则视为续行不重复)
  //   ④ 其余(续行:只追加方法/依据)            ⇒ 否
  const dChanged = !!subName && subName !== (curSub && curSub.name)
  const eIsNewSubRow = !!E && (!curSub || E !== curSub.req)
  const startsNew = !curSub || dChanged || eIsNewSubRow
  if (startsNew) {
    curSub = { name: subName, req: '', method: '', basis: '' }
    curGroup.subs.push(curSub)
  } else if (subName && !curSub.name) {
    curSub.name = subName
  }
  curSub.req = appendDedup(curSub.req, E)
  curSub.method = appendDedup(curSub.method, F)
  curSub.basis = appendDedup(curSub.basis, G)
}

for (const g of groups) {
  g.subs = g.subs.filter((s) => s.req || s.method || s.name)
}

const lib = groups.map((g) => ({
  name: g.name,
  subs: g.subs.map((s) => ({ name: s.name, req: s.req, method: s.method, basis: s.basis })),
}))

console.log('组数 =', lib.length, ' 子项合计 =', lib.reduce((n, g) => n + g.subs.length, 0))
console.log('')
lib.forEach((g, i) => {
  console.log(`${String(i + 1).padStart(2)}. [${g.name}]  subs=${g.subs.length}`)
  g.subs.forEach((s) => {
    console.log(`      - name=${JSON.stringify(s.name)}`)
    console.log(`        req=${JSON.stringify(s.req).slice(0, 130)}`)
    console.log(`        method=${JSON.stringify(s.method).slice(0, 110)}`)
    console.log(`        basis=${JSON.stringify(s.basis).slice(0, 70)}`)
  })
})

if (WRITE) {
  const out = `// 规格书检验标准库(分组)——由 tools/gen/gen-spec-testlib-from-design.cjs 从
// 《规格书细分.xlsx》sheet「检验项目及标准」生成(**勿手改**)。
// 用户口径 2026-09-20:按该 sheet 重建为 18 个检验项目(原有 26 组内容已全部替换)。
// 结构:{name: 组名(检验项目), subs: [{name: 子项名(单子项组为空), req: 检验要求, method: 检验方法, basis: 检验依据}]}
export const SPEC_TEST_LIB = ${JSON.stringify(lib, null, 2)}
`
  const target = path.join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'specTestLib.js')
  fs.writeFileSync(target, out, 'utf8')
  console.log('\n✓ 已写入', target)
  const dump = 'C:/INCER/_rd-work/spec-testlib-new.json'
  fs.writeFileSync(dump, JSON.stringify(lib, null, 2), 'utf8')
  console.log('✓ 已写出核对用 JSON', dump)
}
