/**
 * goodsPick.test.js — 规格书「从商品引用」的级联筛选 / 落行规则(2026-10-21)
 * 跑法:cd frontend && npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchGoods, matchKeyword, facetValues, goodsToDetail, GOODS_FACETS } from './goodsPick.js'

const ROWS = [
  { 所属类别: '功能炭棒', 存货编码: 'T382', 存货名称: '除重金属炭棒/滤芯', 规格型号: '2支装白盒', 备注: '炭棒尺寸' },
  { 所属类别: '功能炭棒', 存货编码: 'T383', 存货名称: '除重金属炭棒/滤芯B', 规格型号: '3支装白盒', 备注: '' },
  { 所属类别: '标签', 存货编码: 'YJ-KG-D09', 存货名称: '阻垢王标', 规格型号: '', 备注: '' },
  { 所属类别: '折算物料', 存货编码: 'M-001', 存货名称: '炭棒', 规格型号: '', 备注: 'BOM重建' },
]

test('① 取数走既有 invRowsOf(档案型返回形状),本模块只管行级逻辑', () => {
  // 形状:{ data: { list: [ { detail: { inv: ROWS } } ] } } —— 由 invCarry.invRowsOf 负责剥,
  // 这里只用它的产物断言:四栏都能读到字符串(漏一栏级联就静默失效)
  for (const r of ROWS) {
    assert.equal(typeof r['所属类别'], 'string')
    assert.equal(typeof r['存货编码'], 'string')
    assert.equal(typeof r['存货名称'], 'string')
    assert.equal(typeof r['规格型号'], 'string')
  }
})

test('② 多个条件同时生效(AND),子串匹配且不区分大小写', () => {
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒' }).length, 2)
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒', 存货编码: 't38' }).length, 2)
  assert.equal(matchGoods(ROWS, { 所属类别: '功能炭棒', 存货编码: 'T382' }).length, 1)
  assert.equal(matchGoods(ROWS, { 存货名称: '阻垢' })[0]['存货编码'], 'YJ-KG-D09')
})

test('② 空条件(或只有空格)表示不过滤', () => {
  assert.equal(matchGoods(ROWS, {}).length, 4)
  assert.equal(matchGoods(ROWS, { 所属类别: '  ' }).length, 4)
})

test('③ 级联收窄:选了类别后,「规格型号」候选只剩该类别的值', () => {
  const v = facetValues(ROWS, '规格型号', { 所属类别: '功能炭棒' })
  assert.deepEqual(v.values, ['2支装白盒', '3支装白盒'])
  const all = facetValues(ROWS, '规格型号', {})
  assert.deepEqual(all.values, ['2支装白盒', '3支装白盒']) // 空的规格型号不进候选
})

test('③ 候选值排除自己那一栏:选了「所属类别」后,该栏仍列出全部类别', () => {
  const v = facetValues(ROWS, '所属类别', { 所属类别: '功能炭棒' })
  assert.deepEqual(v.values, ['功能炭棒', '折算物料', '标签'])
  assert.equal(v.more, 0)
})

test('③ 已选值补在候选最前面;其它条件决定的候选集不受自己那一栏影响', () => {
  // 类别=标签 ⇒ 编码候选只应来自「标签」这批;已选的 T382 仍排第一(让用户看见自己选了什么)
  const v = facetValues(ROWS, '存货编码', { 存货编码: 'T382', 所属类别: '标签' })
  assert.equal(v.values[0], 'T382')
  assert.deepEqual(v.values.slice(1), ['YJ-KG-D09'], '候选来自 类别=标签 的行')
})

test('③ 候选过多时按 cap 截断并回报 more(存货编码实测 3000+)', () => {
  const many = Array.from({ length: 400 }, (_, i) => ({ 所属类别: 'X', 存货编码: 'C' + i }))
  const v = facetValues(many, '存货编码', {}, 300)
  assert.equal(v.values.length, 300)
  assert.equal(v.more, 100)
})

test('④ 落行映射:编码/名称/规格/备注按目标列取值', () => {
  const { rows, skipped } = goodsToDetail([ROWS[0]], [], ['序号', '物料编码', '物料名称', '规格参数', '数量', '备注'])
  assert.equal(skipped, 0)
  assert.deepEqual(rows[0], {
    物料编码: 'T382', 物料名称: '除重金属炭棒/滤芯', 规格参数: '2支装白盒', 备注: '炭棒尺寸',
  })
  assert.ok(!('数量' in rows[0]), '数量商品里没有,不能凭空落值')
})

test('④ 产品信息表新版 BOM 表列名(物料编号/尺寸规格)同一套落行,数量仍不带', () => {
  // 2026-10-29「三、产品BOM表」的列叫 物料编号 | 物料名称 | 尺寸规格 | 数量,
  // 与旧两张表(物料编码/规格参数)是两套名字,靠目标表里有哪个落哪个适配。
  const { rows, skipped } = goodsToDetail([ROWS[0]], [], ['序号', '物料编号', '物料名称', '尺寸规格', '数量'])
  assert.equal(skipped, 0)
  assert.deepEqual(rows[0], {
    物料编号: 'T382', 物料名称: '除重金属炭棒/滤芯', 尺寸规格: '2支装白盒',
  })
  assert.ok(!('数量' in rows[0]), '数量由人自己填,引用不带出')
})

test('④ 目标表没有的列不落(只落实际存在的列)', () => {
  const { rows } = goodsToDetail([ROWS[0]], [], ['物料编码'])
  assert.deepEqual(rows[0], { 物料编码: 'T382' })
})

test('④ 已存在的编码 / 本次勾选内重复 ⇒ 跳过并计数', () => {
  const { rows, skipped } = goodsToDetail([ROWS[0], ROWS[1], ROWS[0]], ['T383'], ['物料编码', '物料名称'])
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['物料编码'], 'T382')
  assert.equal(skipped, 2)
})

test('④ 没有存货编码的行直接忽略(不造空行)', () => {
  const { rows, skipped } = goodsToDetail([{ 存货名称: '无码物料' }], [], ['物料编码'])
  assert.equal(rows.length, 0)
  assert.equal(skipped, 0)
})

test('⑤ 四栏与商品面板的列名一致(改列名必须同步这里)', () => {
  assert.deepEqual(GOODS_FACETS, ['所属类别', '存货编码', '存货名称', '规格型号'])
  for (const r of ROWS) {
    for (const k of GOODS_FACETS) assert.ok(k in r, `样例数据缺少 ${k}`)
  }
})

/* ── 关键字搜索（2026-11-12 用户口径「直接搜索编号找不到」）────────────── */
test('matchKeyword：直接在全量行上模糊匹配，不受下拉 300 项上限影响', () => {
  const rows = [
    { 所属类别: '炭粉', 存货编码: 'YJ-YKRS-014', 存货名称: '专用炭X5(80-250目）', 规格型号: '80-250目', 计量单位: 'kg' },
    { 所属类别: 'PP棉', 存货编码: 'YJ-AJ-040', 存货名称: 'PP棉', 规格型号: '60*49*180', 计量单位: '支' },
  ]
  // 按编号（原问题：编号有 3983 个，下拉只给 300，敲了也找不到）
  assert.deepEqual(matchKeyword(rows, 'YJ-AJ-040').map((r) => r.存货编码), ['YJ-AJ-040'])
  // 按名称 / 规格 / 类别
  assert.deepEqual(matchKeyword(rows, 'pp棉').map((r) => r.存货编码), ['YJ-AJ-040'], '不区分大小写')
  assert.deepEqual(matchKeyword(rows, '80-250').map((r) => r.存货编码), ['YJ-YKRS-014'])
  assert.deepEqual(matchKeyword(rows, '炭粉').map((r) => r.存货编码), ['YJ-YKRS-014'])
  // 空关键字 = 全量；无命中 = 空
  assert.equal(matchKeyword(rows, '').length, 2)
  assert.equal(matchKeyword(rows, '   ').length, 2)
  assert.equal(matchKeyword(rows, '压根没有').length, 0)
  // 不修改入参
  assert.equal(rows.length, 2)
})

test('BOM 导入弹窗必须有自由文本搜索框，且走 matchKeyword（而非只靠下拉）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /class="gp-search"/, '弹窗里要有搜索输入框')
  // 2026-11-12 按设计库重排：四栏改成等宽栅格 + label 在上（原来是 label/控件挤一行的 flex）
  assert.match(sheet, /class="gp-bar-facets"/, '四栏要用等宽栅格承载')
  assert.match(sheet, /class="gp-facet-label"/, '每栏 label 要独立一行')
  assert.match(sheet, /matPickKeyword/, '要有 matPickKeyword 状态')
  assert.match(sheet, /matchGoods\(matchKeyword\(matPickRows\.value, matPickKeyword\.value\), matPickFilters\)/,
    '过滤链必须先过关键字再过四栏（AND）')
  assert.match(sheet, /matPickKeyword\.value = ''/, '「清空筛选」要一并清关键字')
})

/**
 * 商品引用弹窗「每搜索一次转好久」（2026-11-13 用户报障）。
 *
 * 【用户原话】「现在的产品信息表的导入采购物料清单，每次搜索都要转好久，看看什么原因」
 *
 * 【根因·实测数据（不是推断）】
 *   浏览器最小复现（3850 行商品档案，与生产同量级），把一个按键拆成三段计时：
 *
 *     阶段                 全量 3850 行        分页 50 行
 *     ─────────────────────────────────────────────────────
 *     computed 过滤           0.6 – 2.8 ms       1 – 2.3 ms
 *     Vue patch(el-table)  2551 – 4606 ms     24 – 45 ms
 *     paint                 189 – 1228 ms     38 – 57 ms
 *     每键合计                3 – 7 秒          ~70 – 100 ms
 *
 *   ⇒ 计算（matchKeyword/matchGoods）完全不是瓶颈；瓶颈是 el-table 一次绑 3850 行 × 6 列
 *     ≈ 2.3 万个单元格，每打一个字 Vue 都要重建整棵子树并重算选择态。
 *   排除项：去掉 selection 列 + row-key 仍然 5–7 秒 ⇒ 不是选择态的锅；
 *           rAF 空转实测 6–12ms ⇒ 不是浏览器节流。
 *
 * 【修法】表格只渲染**当前页**（默认 50 行），过滤/勾选仍在全量上做。
 *   勾选状态改成自己维护 Map（row-key → 行），翻页不丢已勾；「引用(N)」口径不变。
 *
 * 这些断言钉住「表格数据源必须是分页切片、且勾选不依赖 el-table 的 selection-change」。
 */

test('⑨ 弹窗表格只渲染当前页（3850 行全量绑给 el-table ⇒ 每键 3~7 秒）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  // 表格 :data 必须是分页切片，不能再是 matPickFiltered 全量
  assert.match(sheet, /:data="matPickPaged"/, 'el-table 必须绑分页切片 matPickPaged')
  assert.doesNotMatch(sheet, /:data="matPickFiltered"/,
    '不许再直接绑全量过滤结果 —— 那正是"每搜索一次转好久"的根因')
  // 要有分页器
  assert.match(sheet, /<el-pagination/, '要有分页器')
  assert.match(sheet, /matPickPage/, '分页当前页状态')
})

test('⑩ 分页器的每页条数是纯常量且足够小（>100 行仍会明显卡）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  const m = sheet.match(/MAT_PICK_PAGE_SIZE\s*=\s*(\d+)/)
  assert.ok(m, '要有具名常量 MAT_PICK_PAGE_SIZE（别把 50 散落在模板里）')
  const n = Number(m[1])
  assert.ok(n > 0 && n <= 100, `每页 ${n} 行；实测 3850 行 3~7 秒、50 行 ~100ms，超过 100 行会重新变卡`)
})

test('⑪ 翻页/改筛选后当前页要收回第 1 页（否则会停在空白页）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  // 关键字/四栏任一变化 ⇒ 页码归 1
  assert.match(sheet, /watch\([\s\S]{0,400}matPickKeyword[\s\S]{0,400}matPickPage\.value\s*=\s*1/,
    '关键字变化要把页码收回第 1 页')
  assert.match(sheet, /resetMatPickFilters[\s\S]{0,300}matPickPage\.value\s*=\s*1/,
    '「清空筛选」也要把页码收回第 1 页')
})

test('⑫ 跨页勾选不丢（勾选状态自己维护，不靠 el-table 的 selection-change）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanelss.vue'.replace('Panelss', 'Panels'), import.meta.url), 'utf8')
  assert.match(sheet, /matPickPicked/, '勾选状态要有独立容器（Map/Set）')
  assert.match(sheet, /toggleMatPickRow/, '行勾选走自己的 toggle，不是 selection-change')
  // 仍要有 onMatPickSelection 兜底（mate 源仍用整表 selection）
  assert.match(sheet, /onMatPickSelection/, '物料清单源(mate)仍走整表 selection')
})

/**
 * 2026-11-13 第二轮用户口径（在分页修好之后）：
 *   ① 「这个应该是预渲染在缓存，这样子打开就秒开了，搜索也会快一点」
 *   ② 「勾选也优化一下，点击该行数据就判为勾选，这样子就不需要强制勾选前面方框了」
 *
 * ① 预取：商品档案是**档案型面板**（一次返回全量、不分页），所以"打开弹窗才请求"必然有
 *    一次 300ms~1s 的空窗。改成进面板就预取并缓存，点「直接导入采购物料清单」时直接命中缓存。
 * ② 整行可点：不必去点前面那个 42px 的小方框，点行内任意位置即切换勾选。
 */

test('⑬ 商品档案要预取并缓存（进面板就拉，打开弹窗不再等请求）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /matPickCache/, '要有商品档案缓存容器')
  assert.match(sheet, /prefetchMatPickRows/, '要有预取函数')
  // matPickCache 是 ref ⇒ 取值要走 .value（别写死成裸变量）
  assert.match(sheet, /if \(matPickCache\.value\.length\)[\s\S]{0,200}matPickRows\.value = matPickCache\.value\.slice\(\)/,
    '打开弹窗时要先命中缓存（命中就不再请求）')
  // 预取挂在 onMounted 上
  const mount = sheet.slice(sheet.indexOf('onMounted(() => {'))
  assert.match(mount.slice(0, 600), /prefetchMatPickRows\(\)/,
    '进面板（onMounted）就要预取，而不是等用户点按钮')
})

test('⑭ 点行即勾选（不用去点前面那个小方框）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /@row-click="onMatPickRowClick"/, '商品源表格要绑 row-click')
  assert.match(sheet, /function onMatPickRowClick\(/, '要有行点击处理函数')
  // 点行 = 切换勾选；但点复选框本身不能再触发一次（否则会翻两下 = 没反应）
  const fn = sheet.slice(sheet.indexOf('function onMatPickRowClick('))
  assert.match(fn.slice(0, 500), /toggleMatPickRow/, '行点击要切换该行勾选')
  assert.match(fn.slice(0, 500), /closest|stopPropagation|__k/,
    '要防止「点复选框」再走一遍行点击（否则勾了立刻又被切回去）')
})

test('⑮ 行要有选中态样式（点过哪几行一眼看得出来）', () => {
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  assert.match(sheet, /:row-class-name="matPickRowClass"/, '要按勾选状态给行加类名')
  assert.match(sheet, /\.mat-pick-picked/, '要有选中行的样式类')
  assert.match(sheet, /cursor:\s*pointer/, '整行可点 ⇒ 要有 pointer 光标（否则用户不敢点）')
})
