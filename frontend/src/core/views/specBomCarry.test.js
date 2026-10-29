/**
 * specBomCarry.test.js —— 规格书「1.关键物料列表」由产品编号选择自动带出
 *
 * 【需求来源】用户 2026-10-29 口径:
 *   「现在把这个规格书的 1.关键物料列表 改为在选择产品信息表的产品编号的时候,
 *     由产品信息表带过来」
 *   「从产品信息表的 BOM 明细带」(追问数据源时的回答)
 *   「B. 清空后整表重带」(追问已有手工行怎么处理时的回答)
 *
 * 【链路澄清(两条链同源)】
 *   产品信息表 BOM 明细 = **权威源**;产品信息表归档时它同时被写进物料清单(mate)
 *   (见后端 ButtonService.syncProdBomToMaterialList)。
 *   ⇒ 规格书带料**直接读产品信息表的 BOM 明细**,不绕道物料清单 —— 避免"归档前物料清单还没有
 *     这批料、规格书就带不出来"的空窗。
 *
 * 【覆盖语义 B = 清空后整表重带】
 *   换成另一个产品编号时,必须先把本表区已有的物料行**清空**,再按新产品的 BOM 整批重建。
 *   否则旧产品的料会残留在新产品的规格书里(比"少了行"严重得多)。
 *   这也是它**不能**沿用既有「从物料清单引用」(那是追加 + 去重)的原因。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panels = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

function fnBody(src, name, max = 6000) {
  const at = src.indexOf('function ' + name)
  assert.ok(at >= 0, `找不到 ${name}`)
  const rest = src.slice(at + 10)
  const m = rest.search(/\n(?:async )?function |\n\/\/ ──|\n\/\*\*/)
  return src.slice(at, at + (m > 0 ? m + 10 : max))
}

test('① 选完产品编号后自动带 BOM(confirmProdPick 里要调用带货函数)', () => {
  const fn = fnBody(panels, 'confirmProdPick')
  assert.match(fn, /carryBomFromProdBom\s*\(/, 'confirmProdPick 末尾要触发带料')
})

test('② 数据源 = 产品信息表的 BOM 明细(不是物料清单)', () => {
  const fn = fnBody(panels, 'carryBomFromProdBom', 4000)
  assert.match(fn, /RD_PROD_INFO/, '要读产品信息表')
  assert.match(fn, /detail\?\.items|detail\.items/, '明细在 detail.items')
  assert.ok(!/WLBOM/.test(fn), '不能绕道物料清单(归档前它还没有这批料)')
})

test('③ 覆盖语义 = 先清空再重带(B 方案),不能是追加', () => {
  const fn = fnBody(panels, 'carryBomFromProdBom', 4000)
  assert.match(fn, /splice\(0,\s*cur\.length\)|splice\(0,\s*\w+\.length\)/, '必须先清空本表区已有行')
  // 清空要在 addRow 循环之前
  const clearAt = fn.search(/splice\(0,/)
  const addAt = fn.search(/addRow\(dt\)/)
  assert.ok(clearAt > 0 && addAt > clearAt, '清空必须发生在逐行重建之前')
})

test('④ 字段映射与物料清单口径一致:物料编码←物料编号 / 规格参数←尺寸规格 / 数量←数量', () => {
  const fn = fnBody(panels, 'carryBomFromProdBom', 4000)
  assert.match(fn, /物料编码.*物料编号|row\['物料编码'\]\s*=\s*code/, '物料编码 ← 物料编号')
  assert.match(fn, /规格参数.*尺寸规格/, '规格参数 ← 尺寸规格')
  assert.match(fn, /数量.*r\['数量'\]|row\['数量'\]\s*=\s*String\(r\['数量'\]/, '数量 ← 数量')
  assert.match(fn, /物料名称.*物料名称/, '物料名称 ← 物料名称')
})

test('⑤ 只认带 1.关键物料列表 的那张表(不能误伤规格书其它表区)', () => {
  const fn = fnBody(panels, 'carryBomFromProdBom', 4000)
  assert.match(fn, /tablesAfterBar === '1\.关键物料列表'/, '要按锚点精确定位那张表')
})

test('⑥ 取数失败只提示、不抛(不能把已完成的产品编号引用回滚掉)', () => {
  const fn = fnBody(panels, 'carryBomFromProdBom', 4000)
  assert.match(fn, /try\s*\{/, '要有 try')
  assert.match(fn, /catch\s*\(/, '要有 catch')
  assert.match(fn, /ElMessage\.(warning|error|info)/, '失败要有提示')
})
