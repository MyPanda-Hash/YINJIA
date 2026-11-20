/**
 * 样品检验汇总表「勾选委托单 → 只导所选行」(2026-11-20)
 *
 * 用户口径:「为当前的样品检验汇总表能够勾选检验委托单行,为实现当前导出 Excel 的功能能够选择所需的行」。
 *
 * 契约:
 *   · 「按委托单/样品」表加勾选列 + 行键 单据编号;勾中的行在工具条回显条数,可一键清除;
 *   · 导出按钮文案随勾选变「导出所选 Excel (N)」;
 *   · 请求体在勾选非空时带 单据编号[](后端精确匹配,不做模糊);不勾 = 不传 = 导全部(原行为不变);
 *   · 每次重新查询都清勾选(所选行必须属于当前结果集)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../../views/modules/qc/InspSummary.vue', import.meta.url), 'utf8')
const service = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/InspSummaryService.java', import.meta.url), 'utf8')

test('「按委托单/样品」表带勾选列与勾选状态', () => {
  assert.match(page, /<el-table ref="docTableRef"[^\n]*row-key="单据编号"/, '单据表要有 ref 与行键(行键决定勾选身份的稳定性)')
  assert.match(page, /<el-table-column type="selection"[^\n]*\/>/, '缺勾选列')
  assert.match(page, /@selection-change="onDocSelection"/, '缺勾选变化处理')
  assert.match(page, /const selectedDocs = ref\(\[\]\)/, '缺勾选状态')
  assert.match(page, /function onDocSelection\(rows\)[\s\S]{0,160}selectedDocs\.value/, '勾选变化要落到 selectedDocs')
})

test('工具条回显 + 导出按钮文案随勾选变化', () => {
  assert.match(page, /v-if="selectedDocs\.length" class="iss-picked"/, '勾选回显条')
  assert.match(page, /clearSelection/, '要能一键清除勾选')
  assert.match(page, /const exportLabel = computed\(/, '导出按钮文案要按勾选算')
  assert.match(page, /导出所选 Excel/, '勾选时按钮文案要说明「只导所选」')
})

test('导出请求:勾选非空带 单据编号[],否则不带(导全部)', () => {
  assert.match(page, /const picked = selectedDocs\.value\.map\(\(d\) => d\['单据编号'\]\)\.filter\(Boolean\)/,
    '从勾选行取单号')
  assert.match(page, /if \(picked\.length\) body\.单据编号 = picked/, '勾选非空才带 单据编号')
  assert.match(page, /request\.post\('\/px\/inspSummary\/export', body, \{ responseType: 'blob' \}\)/,
    '导出仍走原接口,条件体统一构造')
})

test('重新查询/重置清勾选,避免导出看不见的行', () => {
  const load = page.slice(page.indexOf('async function load()'), page.indexOf('async function load()') + 800)
  assert.match(load, /clearSelection\(\)/, 'load() 开头要清勾选')
})

test('后端按 单据编号 精确过滤;缺省/空 = 不过滤(全导,原行为)', () => {
  assert.match(service, /Set<String> picked = pickedDocNos\(body\);/, '导出要解析勾选单号')
  assert.match(service, /if \(picked\.contains\(strOf\(d\.get\("单据编号"\)\)\)\) only\.add\(d\);/, '按单号精确匹配')
  assert.match(service, /private static Set<String> pickedDocNos\(Map<String, Object> body\)/, '缺 pickedDocNos')
  assert.match(service, /if \(body == null\) return null;/, '无请求体 = 全导')
  assert.match(service, /return picked\.isEmpty\(\) \? null : picked;/, '空数组 = 全导(不返回空集把 Excel 导成空表)')
})
