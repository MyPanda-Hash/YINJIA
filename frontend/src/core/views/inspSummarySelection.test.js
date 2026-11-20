/**
 * 样品检验汇总表「勾选委托单 → 只导所选行」(2026-11-20)
 *
 * 用户口径(第一轮):「为当前的样品检验汇总表能够勾选检验委托单行,为实现当前导出 excel 的功能能够选择所需的行」。
 * 用户口径(第二轮,2026-11-20 12:20):「按送样人也要能勾选」⇒ 两个视角都能勾,共用一份勾选真源:
 *   · 「按送样人」表勾一个送样人 = 他名下全部委托单;展开后「该送样人的委托单」子表还能逐张勾/取消;
 *   · 「按委托单/样品」表照旧逐张勾;
 *   · 三者最终都归一到 selectedNos(单据编号集合),导出只认它;不勾 = 导全部(原行为)。
 *
 * 本测试钉住"改一处漏一处就静默失效"的点:勾选入口、真源、同步守卫、导出传参。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../../views/modules/qc/InspSummary.vue', import.meta.url), 'utf8')
const service = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/InspSummaryService.java', import.meta.url), 'utf8')

test('两个视角 + 展开子表都能勾选', () => {
  // 按送样人表:勾选列 + 行键 + 勾选处理
  assert.match(page, /<el-table ref="senderTableRef"[^\n]*row-key="送样人"/, '按送样人表要有 ref 与行键')
  assert.match(page, /@selection-change="onSenderSelection"/, '按送样人表缺勾选处理')
  // 按委托单表
  assert.match(page, /<el-table ref="docTableRef"[^\n]*row-key="单据编号"/, '单据表要有 ref 与行键')
  assert.match(page, /@selection-change="onDocSelection"/, '按委托单表缺勾选处理')
  // 展开后的委托单子表
  assert.match(page, /:ref="\(el\) => bindSubTable\(row\['送样人'\], el\)"/, '展开子表要登记实例(勾选同步用)')
  // 子表用 select / select-all 而不是 selection-change:子表在展开时是"新挂载"的,
  // selection-change 会在挂载/数据就绪阶段先发一次空数组,误当成"用户取消全部"⇒ 勾选被清空(2026-11-20 实测踩到)
  assert.match(page, /@select="\(sel\) => onSubSelection\(row\['送样人'\], sel\)"/, '展开子表缺 select 处理')
  assert.match(page, /@select-all="\(sel\) => onSubSelection\(row\['送样人'\], sel\)"/, '展开子表缺 select-all 处理')
  assert.doesNotMatch(page, /@selection-change="\(rows\) => onSubSelection/, '子表不能用 selection-change(挂载即发空事件)')
  const selectionCols = page.match(/<el-table-column type="selection"/g) || []
  assert.ok(selectionCols.length >= 3, `三张表都要有勾选列,实际 ${selectionCols.length} 处`)
})

test('勾选真源唯一:selectedNos(单据编号),同步期间有递归守卫', () => {
  assert.match(page, /const selectedNos = ref\(\[\]\)/, '缺勾选真源 selectedNos')
  assert.match(page, /let syncing = false/, '缺程序化 toggle 的递归守卫')
  // 三个入口都先判守卫,再改真源
  for (const fn of ['onDocSelection', 'onSenderSelection', 'onSubSelection']) {
    const seg = page.slice(page.indexOf(`function ${fn}(`), page.indexOf(`function ${fn}(`) + 400)
    assert.match(seg, /if \(syncing\) return/, `${fn} 必须先判 syncing 守卫`)
  }
  assert.match(page, /function applySelection\(nos, origin = null\)[\s\S]{0,200}syncTables\(origin\)/, '改真源后必须重画三张表')
  assert.match(page, /function syncTables\(origin = null\)[\s\S]{0,120}syncing = true/, 'syncTables 必须先置守卫')
  // 来源表自己不能再 clear+toggle(会把 Element 表头全选态搞乱,"取消全选"点不动)
  assert.match(page, /if \(!origin \|\| origin\.type !== 'sender'\)/, '来源是送样人表时别重画它自己')
  // 勾/取消送样人 = 按"该送样人的单是否已全进"对齐真源(不能用上一次勾选做增量:
  // 表头取消全选时增量为空,执行后会残留 3 张 —— 2026-11-20 实测踩到)
  assert.match(page, /function nosOfSender\(name\)/, '缺 nosOfSender(送样人 → 单号)')
  assert.match(page, /const fullyOn = nos\.every\(\(n\) => next\.has\(n\)\)/, '要按全进/非全进判断')
  assert.match(page, /if \(pickedNames\.has\(name\) && !fullyOn\) nos\.forEach\(\(n\) => next\.add\(n\)\)/,
    '勾送样人要把他名下全部单号放进真源')
  assert.match(page, /else if \(!pickedNames\.has\(name\) && fullyOn\) nos\.forEach\(\(n\) => next\.delete\(n\)\)/,
    '取消送样人要把他的单移出真源(取消全选必须生效)')
})

test('工具条回显 + 导出按钮文案随勾选变化', () => {
  assert.match(page, /v-if="selectedNos\.length" class="iss-picked"/, '勾选回显条要读真源')
  assert.match(page, /clearSelection/, '要能一键清除勾选')
  assert.match(page, /const exportLabel = computed\(/, '导出按钮文案要按勾选算')
  assert.match(page, /导出所选 Excel/, '勾选时按钮文案要说明「只导所选」')
})

test('清除勾选要连展开子表一起清,查询前置清勾选', () => {
  const seg = page.slice(page.indexOf('function clearSelection()'), page.indexOf('function clearSelection()') + 500)
  assert.match(seg, /docTableRef\.value\?\.clearSelection\?\.\(\)/, '按委托单表没清')
  assert.match(seg, /senderTableRef\.value\?\.clearSelection\?\.\(\)/, '按送样人表没清')
  assert.match(seg, /for \(const t of subTables\.values\(\)\) t\.clearSelection\?\.\(\)/, '展开子表没清')
  assert.match(page, /async function load\(\)[\s\S]{0,600}clearSelection\(\)/, 'load() 开头要清勾选')
})

test('导出请求:勾选非空带 单据编号[],否则不带(导全部)', () => {
  assert.match(page, /const picked = selectedNos\.value\.slice\(\)/, '导出要从真源取勾选单号')
  assert.match(page, /if \(picked\.length\) body\.单据编号 = picked/, '勾选非空才带 单据编号')
  assert.match(page, /request\.post\('\/px\/inspSummary\/export', body, \{ responseType: 'blob' \}\)/,
    '导出仍走原接口,条件体统一构造')
})

test('后端按 单据编号 精确过滤;缺省/空 = 不过滤(全导,原行为)', () => {
  assert.match(service, /Set<String> picked = pickedDocNos\(body\);/, '导出要解析勾选单号')
  assert.match(service, /if \(picked\.contains\(strOf\(d\.get\("单据编号"\)\)\)\) only\.add\(d\);/, '按单号精确匹配')
  assert.match(service, /private static Set<String> pickedDocNos\(Map<String, Object> body\)/, '缺 pickedDocNos')
  assert.match(service, /if \(body == null\) return null;/, '无请求体 = 全导')
  assert.match(service, /return picked\.isEmpty\(\) \? null : picked;/, '空数组 = 全导(不返回空集把 Excel 导成空表)')
})
