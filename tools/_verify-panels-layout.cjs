/**
 * _verify-panels-layout.cjs —— 校验「两页各用原版式」的配置结构(配置层)。
 *
 * 核心断言:页 1 / 页 2 实际渲染的区块与数据表,与**合并前原文**(e20bd9a~1)逐字一致
 * (仅多了 page 标记 / 摘掉了面板级 headMode),且其它面板零改动。
 *
 * 用法:node tools/_verify-panels-layout.cjs
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const ROOT = path.resolve(__dirname, '..')

/** 把 ESM 配置模块求值成普通对象;typeof 守卫用于兼容合并前(没有新常量的)原文 */
function load(src) {
  return new Function(
    src
      .replace(/^import \{ SPEC_TEST_LIB \}.*$/m, 'const SPEC_TEST_LIB = []')
      .replace('export const recordSheetConfigs =', 'const recordSheetConfigs =') +
      '\nreturn { recordSheetConfigs,' +
      ' DT0: typeof RD_ASM_PROC_DT0 !== "undefined" ? RD_ASM_PROC_DT0 : null,' +
      ' MOLD_SEC0: typeof RD_MOLD_PROC_SEC0 !== "undefined" ? RD_MOLD_PROC_SEC0 : null,' +
      ' MOLD_FORMULA: typeof RD_MOLD_FORMULA !== "undefined" ? RD_MOLD_FORMULA : null,' +
      ' ASM_BOM: typeof RD_ASM_BOM !== "undefined" ? RD_ASM_BOM : null }'
  )()
}

const mod = load(fs.readFileSync(path.join(ROOT, 'frontend/src/core/views/recordSheetConfigs.js'), 'utf8'))
const c = mod.recordSheetConfigs

const preRaw = execFileSync('git', ['show', 'e20bd9a~1:frontend/src/core/views/recordSheetConfigs.js'], {
  cwd: ROOT,
  maxBuffer: 16 * 1024 * 1024,
}).toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const pre = load(preRaw).recordSheetConfigs

let fail = 0
const ok = (cond, msg, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + extra : ''))
  if (!cond) fail++
}
const pg = (arr) => (arr || []).map((b) => b.page ?? 0)
const sum = (a) => a.reduce((x, y) => x + y, 0)
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const stripPage = (o) => {
  if (Array.isArray(o)) return o.map(stripPage)
  if (o && typeof o === 'object') {
    const out = {}
    for (const k of Object.keys(o)) if (k !== 'page') out[k] = stripPage(o[k])
    return out
  }
  return o
}
/** 去掉「分块键」——配方表原本独占一张明细表,配置里没有 tableArea;并入后与主面板共用
 *  rd_mold_proc_detail,必须挂 filterKey/filterVal 才能把配方行写进去并按表区读回来。
 *  这是功能元数据(不是版式),比较版式时把它摘掉,单独断言它的存在与取值。 */
const stripArea = (o) => {
  if (Array.isArray(o)) return o.map(stripArea)
  if (o && typeof o === 'object') {
    const out = {}
    for (const k of Object.keys(o)) if (k !== 'filterKey' && k !== 'filterVal') out[k] = stripArea(o[k])
    return out
  }
  return o
}

console.log('╔══ 0. 合并前原文基线 ══（e20bd9a~1）')
ok(c.RD_MOLD_PROC != null && pre.RD_MOLD_PROC != null, '取到两版 RD_MOLD_PROC')
ok(pre.RD_MOLD_PROC.grid.length === 11, '合并前 成型工艺清单 = 11 列网格', JSON.stringify(pre.RD_MOLD_PROC.grid))
ok(pre.RD_MOLD_FORMULA.grid.length === 13, '合并前 成型配方 = 13 列网格', JSON.stringify(pre.RD_MOLD_FORMULA.grid))
ok(pre.RD_ASM_BOM.grid.length === 4, '合并前 组装BOM表 = 4 列网格', JSON.stringify(pre.RD_ASM_BOM.grid))
ok(pre.RD_ASM_PROC.headMode === 'plain', "合并前 组装工艺清单 = headMode 'plain'")

console.log('╔══ 1. 页签标题与每页网格 ══')
ok(eq(c.RD_MOLD_PROC.pages.map((p) => p.title), ['成型工艺清单', '成型配方']), '成型面板页签 = 成型工艺清单 / 成型配方')
ok(eq(c.RD_ASM_PROC.pages.map((p) => p.title), ['组装工艺清单', '组装BOM表']), '组装面板页签 = 组装工艺清单 / 组装BOM表')
ok(eq(c.RD_MOLD_PROC.pages[0].grid, pre.RD_MOLD_PROC.grid), '成型 页1 grid ≡ 原文 11 列', JSON.stringify(c.RD_MOLD_PROC.pages[0].grid))
ok(eq(c.RD_MOLD_PROC.pages[1].grid, pre.RD_MOLD_FORMULA.grid), '成型 页2 grid ≡ 原文 13 列', JSON.stringify(c.RD_MOLD_PROC.pages[1].grid))
ok(sum(c.RD_MOLD_PROC.pages[0].grid) === 1040, '成型 页1 总宽 1040', sum(c.RD_MOLD_PROC.pages[0].grid))
ok(sum(c.RD_MOLD_PROC.pages[1].grid) === 1040, '成型 页2 总宽 1040', sum(c.RD_MOLD_PROC.pages[1].grid))
ok(eq(c.RD_MOLD_PROC.pages[1].head, pre.RD_MOLD_FORMULA.head), '成型 页2 报告头跨度 ≡ 原文(title7/label2/value4)')
ok(
  c.RD_MOLD_PROC.pages[1].head.title + c.RD_MOLD_PROC.pages[1].head.infoLabel + c.RD_MOLD_PROC.pages[1].head.infoValue ===
    c.RD_MOLD_PROC.pages[1].grid.length,
  '成型 页2 报告头三段跨度合计 = 13 = 网格列数'
)
ok(c.RD_MOLD_PROC.pages[0].headMode === undefined && c.RD_MOLD_PROC.pages[1].headMode === undefined, '成型两页不声明版式(同为面板缺省 report)')
ok(c.RD_ASM_PROC.pages[0].headMode === undefined, '组装 页1 不声明版式(用面板缺省 plain)')
ok(c.RD_ASM_PROC.pages[1].headMode === 'report', "组装 页2 声明 headMode='report'(按原文版式)")
ok(eq(c.RD_ASM_PROC.pages[1].grid, pre.RD_ASM_BOM.grid), '组装 页2 grid ≡ 原文 4 列', JSON.stringify(c.RD_ASM_PROC.pages[1].grid))
ok(sum(c.RD_ASM_PROC.pages[1].grid) === 1040, '组装 页2 总宽 1040')

console.log('╔══ 2. 区块按页归属(互不串页)══')
const moldPages = c.RD_MOLD_PROC.sections.map((s) => s.page ?? 0)
ok(moldPages.length === 4 && moldPages.slice(0, 3).every((p) => p === 0) && moldPages[3] === 1, '成型 sections = [页1×3, 页2×1]', JSON.stringify(moldPages))
ok(c.RD_MOLD_PROC.dataTables.every((d) => (d.page ?? 0) === 1), '成型 dataTables 全归页2(配方表)')
ok(c.RD_MOLD_PROC.tailSections.every((d) => (d.page ?? 0) === 1), '成型 tailSections 全归页2(配料要求)')
ok(eq(c.RD_ASM_PROC.sections.map((s) => s.page ?? 0), [1]), '组装 sections 全归页2(一、产品基本信息)')
ok(eq(pg(c.RD_ASM_PROC.dataTables), [0, 1, 1]), '组装 dataTables = [页1工序清单, 页2物料清单, 页2修订记录]', JSON.stringify(pg(c.RD_ASM_PROC.dataTables)))

console.log('╔══ 3. 页 1 / 页 2 内容 ≡ 合并前原文(逐字)══')
ok(
  eq(stripPage(c.RD_MOLD_PROC.sections.filter((s) => (s.page ?? 0) === 0)), pre.RD_MOLD_PROC.sections),
  '成型 页1 区块 ≡ 原文(产品基本信息/工序/检验要求)',
  c.RD_MOLD_PROC.sections.filter((s) => (s.page ?? 0) === 0).map((s) => s.bar).join('/')
)
ok(
  eq(stripPage(c.RD_MOLD_PROC.sections.filter((s) => (s.page ?? 0) === 1)), pre.RD_MOLD_FORMULA.sections),
  '成型 页2 区块 ≡ 原文(产品基本信息)'
)
ok(eq(stripArea(stripPage(c.RD_MOLD_PROC.dataTables)), stripArea(pre.RD_MOLD_FORMULA.dataTables)), '成型 页2 配方表 ≡ 原文(7 列 13 格;摘掉分块键后逐字相同)')
ok(eq(stripArea(stripPage(mod.MOLD_FORMULA.dataTables)), stripArea(pre.RD_MOLD_FORMULA.dataTables)), '(常量)RD_MOLD_FORMULA.dataTables ≡ 原文(摘掉分块键后)')
// 分块键:配方行要落进共用明细表并可按表区读回,少了它新增行会以 表区=NULL 存进去、下次读不回来
const moldRecipeDt = c.RD_MOLD_PROC.dataTables.filter((d) => d.bar === '配方表')[0]
ok(moldRecipeDt?.filterKey === '表区' && moldRecipeDt?.filterVal === '配方表',
  `成型 页2 配方表挂分块键 filterKey/filterVal = 表区/配方表(实际 ${JSON.stringify([moldRecipeDt?.filterKey, moldRecipeDt?.filterVal])})`)
ok(c.RD_ASM_PROC.dataTables[1]?.filterKey === '表区' && c.RD_ASM_PROC.dataTables[1]?.filterVal === '物料清单',
  '组装 页2 物料清单分块键 = 表区/物料清单(与原文一致)')
ok(eq(stripPage(c.RD_MOLD_PROC.tailSections), pre.RD_MOLD_FORMULA.tailSections), '成型 页2 配料要求 ≡ 原文')
ok(eq(stripArea(stripPage(mod.MOLD_FORMULA.sections)), pre.RD_MOLD_FORMULA.sections), '(常量)RD_MOLD_FORMULA.sections ≡ 原文')
ok(eq(stripPage(mod.MOLD_FORMULA.tailSections), pre.RD_MOLD_FORMULA.tailSections), '(常量)RD_MOLD_FORMULA.tailSections ≡ 原文')
ok(eq(stripPage(c.RD_ASM_PROC.sections), pre.RD_ASM_BOM.sections), '组装 页2 区块 ≡ 原文 RD_ASM_BOM.sections')
ok(eq(stripPage(c.RD_ASM_PROC.dataTables.slice(1)), pre.RD_ASM_BOM.dataTables), '组装 页2 两张表 ≡ 原文(物料清单/修订记录)')
ok(eq(stripPage(mod.ASM_BOM.sections), pre.RD_ASM_BOM.sections), '(常量)RD_ASM_BOM.sections ≡ 原文')
ok(eq(stripPage(mod.ASM_BOM.dataTables), pre.RD_ASM_BOM.dataTables), '(常量)RD_ASM_BOM.dataTables ≡ 原文')

console.log('╔══ 4. 页 1 原版式细节 ══')
ok(eq(mod.DT0, pre.RD_ASM_PROC.dataTables), '组装 页1 数据表 ≡ 原文 RD_ASM_PROC.dataTables(逐字)')
ok(eq(c.RD_ASM_PROC.dataTables[0].cols.map((x) => x.w), [130, 320, 430, 120]), '组装 页1 列宽 ≡ 原文 130/320/430/120', JSON.stringify(c.RD_ASM_PROC.dataTables[0].cols.map((x) => x.w)))
ok(sum(c.RD_ASM_PROC.dataTables[0].cols.map((x) => x.w || 100)) === 1000, '组装 页1 表宽 = 原文 1000(不是被改坏的 1040)')
ok(c.RD_ASM_PROC.dataTables[0].seedRows.length === 21, '组装 页1 21 道工序预置')
ok(c.RD_ASM_PROC.plainTitle === pre.RD_ASM_PROC.plainTitle, '组装 页1 标题条 ≡ 原文单字符串(未被改成数组)')
ok(mod.MOLD_FORMULA.headMode === undefined, '成型配方常量已摘掉面板级 headMode')
ok(mod.ASM_BOM.headMode === undefined, '组装BOM常量已摘掉面板级 headMode')
ok(eq(stripPage(mod.MOLD_SEC0), pre.RD_MOLD_PROC.sections), '成型 页1 区块常量 ≡ 原文 RD_MOLD_PROC.sections')

console.log('╔══ 5. 其它面板零影响 ══')
const CHANGED = new Set(['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_MOLD_FORMULA', 'RD_ASM_BOM'])
const diffs = []
let same = 0
for (const k of Object.keys(pre)) {
  if (CHANGED.has(k)) continue
  if (c[k] === undefined) { diffs.push(k + '(缺失)'); continue }
  if (eq(c[k], pre[k])) same++
  else diffs.push(k)
}
ok(diffs.length === 0, `除本次刻意改动的 2 个面板外,其余 ${same} 个面板配置与合并前逐字一致`, diffs.length ? 'DIFF: ' + diffs.join(',') : '')

console.log(fail === 0 ? '\n✅ 全部通过 (0 FAIL)' : '\n❌ ' + fail + ' 项 FAIL')
process.exit(fail === 0 ? 0 : 1)
