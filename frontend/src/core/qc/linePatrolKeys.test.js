/**
 * 巡线记录表：**显示标签** 与 **物理列名** 必须分开（2026-11-17 Excel #13；2026-11-20 第 4 条定稿）。
 *
 * 用户口径（2026-11-17）：「原列标题为 两端密度（伊可普高品质炭棒需要测试），
 *   实际搞错为 两液密度（伊玛印品耐水煮要求测试）」；
 * 用户口径（2026-11-20 第 4 条，取代 11-17 的显示口径）：「两端密度（伊可普高品质炭棒需要测试）
 *   修改为两液密度（伊玛印品耐水煮要求测试）」—— 改的是**显示名**。
 *
 * ⚠ 首次改版踩过的坑：把数据键 `两液密度` 一起改成了 `两端密度`，
 *   而 qc_line_patrol_detail 的物理列仍是 [两液密度] ⇒ 线上整列读不到值、
 *   新行保存也写不进库（列表显示为空）。数据键按 ADR-0001 是中文原样、不随显示口径变。
 *
 * 这些断言把「key=物理列、label=业务口径」钉死。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('./QcLinePatrolSheet.vue', import.meta.url), 'utf8')

test('密度列的 key 必须是物理列名「两液密度」，label 才是「两液密度（伊玛印品耐水煮要求测试）」', () => {
  // 找到 COLUMNS 里那条密度列定义
  const m = vue.match(/\{\s*key:\s*'([^']+)',\s*label:\s*'([^']*密度[^']*)'/)
  assert.ok(m, '找不到密度列定义')
  assert.equal(m[1], '两液密度', 'key 必须等于物理列名（改了线上就读不到值）')
  assert.equal(m[2], '两液密度（伊玛印品耐水煮要求测试）', 'label 必须是 2026-11-20 第 4 条的业务口径')
})

test('DETAIL_KEYS 里必须是「两液密度」（新建行按物理列铺值）', () => {
  const at = vue.indexOf('const DETAIL_KEYS')
  assert.ok(at > 0, '缺 DETAIL_KEYS')
  const seg = vue.slice(at, at + 700)
  assert.match(seg, /'两液密度'/, 'DETAIL_KEYS 必须含物理列名 两液密度')
  assert.doesNotMatch(seg, /'两端密度'/, 'DETAIL_KEYS 不能出现显示名（那不是物理列）')
})

test('产品信息确认只保留 1 组编号/型号（用户口径「现在就只有一个编号和型号」）', () => {
  const at = vue.indexOf('const SUB_ROWS')
  assert.ok(at > 0, '缺 SUB_ROWS')
  // 用「下一个常量定义」当右边界，避免切到 SUB_ROWS 内部的第一个 ']'
  const end = vue.indexOf('const DETAIL_KEYS', at)
  assert.ok(end > at, '找不到 DETAIL_KEYS 作为边界')
  const seg = vue.slice(at, end)
  assert.match(seg, /编号1/, '要有编号1')
  assert.match(seg, /型号1/, '要有型号1')
  // 只看 field: 定义 —— 段内注释里为了说明历史会提到「编号2/型号2」，不能算进来
  assert.doesNotMatch(seg, /field:\s*'编号2'/, '不得再有第二组（field 编号2）')
  assert.doesNotMatch(seg, /field:\s*'型号2'/, '不得再有第二组（field 型号2）')
})

test('新建草稿不默认铺块（2026-11-20 第 2 条：需要自己手动新增行）', () => {
  // 只留「＋ 新增巡线记录」入口；源码里不许再有自动铺块的实现
  assert.doesNotMatch(vue, /DEFAULT_BLOCKS/, '不得再有 DEFAULT_BLOCKS（自动铺 3 块）')
  assert.doesNotMatch(vue, /seedBlocksOnce/, '不得再有 seedBlocksOnce（自动补块）')
})

test('新增一块时「巡线时间」自动填当前时间（2026-11-20 第 1 条）', () => {
  const at = vue.indexOf('function newBlock')
  assert.ok(at > 0, '缺 newBlock()')
  const end = vue.indexOf('function renumber', at)
  assert.ok(end > at, '找不到 renumber 作为边界')
  const seg = vue.slice(at, end)
  assert.match(seg, /\[['"]巡线时间['"]\]\s*=\s*nowStamp\(\)/, 'newBlock 必须用 nowStamp() 预填巡线时间')

  const fnAt = vue.indexOf('function nowStamp')
  assert.ok(fnAt > 0, '缺 nowStamp()')
  const fnSeg = vue.slice(fnAt, fnAt + 400)
  assert.match(fnSeg, /getFullYear/, 'nowStamp 按本地时间格式化')
  assert.match(fnSeg, /getMinutes/, 'nowStamp 精确到分')
})
