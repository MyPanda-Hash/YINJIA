/**
 * X烧结配方表落库精度（2026-11-17 用户口径，Excel #10 截图）。
 *
 * 用户截图红字标注：
 *   · 单支含量 `25.851768` / `33.719698` / `2.24798` → 「小数位错误」
 *   · 炭棒重量 `109.414949` / `112.398993` → 「小数位错误」
 *   · 添加比例列印 `23` / `30` / `45` → 「没有百分比号」
 *
 * 根因：落库格式函数写死 `Math.round(n*1e6)/1e6`（6 位小数），所有列一刀切。
 * 计算精度不能降（多道工序连乘中途截断会累积误差），只在**落库/上纸**按列语义收敛。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dlg = readFileSync(new URL('./XsinterCalcDialog.vue', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')

test('落库格式按列语义分精度（长度/重量 2 位、密度 3 位、比例与单支 2 位去尾零）', () => {
  const at = dlg.indexOf('const fmt = (v, kind')
  assert.ok(at > 0, 'fmt 必须接收 kind 参数')
  const seg = dlg.slice(at, at + 1200)
  // 2026-11-18 用户打印截图红字：「2位小数」标在长度/重量上、「3位小数」标在密度上
  assert.match(seg, /kind === 'len2'\) return n\.toFixed\(2\)/, '长度 2 位且补零')
  assert.match(seg, /kind === 'density'\) return n\.toFixed\(3\)/, '密度 3 位')
  assert.match(seg, /kind === 'weight'\) return n\.toFixed\(2\)/, '重量 2 位且补零')
  assert.match(seg, /kind === 'ratio' \|\| kind === 'piece'\) return String\(Math\.round\(n \* 100\) \/ 100\)/,
    '比例/单支含量 2 位去尾零')
})

test('关键列必须真的用上新精度', () => {
  assert.match(dlg, /添加比例: fmt\(percentOf\(actual\), 'ratio'\)/, '添加比例要 2 位')
  // 2026-11-18：回填改为只写有物料的行（用户口径「没有数据的行自己去掉」），
  //   过滤后原始下标改名 idx ⇒ 取值用 c.rows[idx]，精度口径不变。
  assert.match(dlg, /'单支含量g': fmt\(c\.rows\[(i|idx)\]\?\.perPiece, 'piece'\)/, '单支含量要 2 位')
  assert.match(dlg, /'炭棒重量下限g': fmt\(c\.weight\.low, 'weight'\)/, '炭棒重量要 2 位')
  // 2026-11-18 用户口径改为 **2 位小数**（180.50），原来 1 位
  assert.match(dlg, /'切炭长度中间值mm': fmt\(c\.cut\.mid, 'len2'\)/, '切炭长度 2 位')
  // 密度要求 3 位（0.550）；重量 2 位且补零（112.40）
  assert.match(dlg, /'密度要求下限': fmt\(c\.density\.low, 'density'\)/, '密度 3 位')
  assert.match(dlg, /kind === 'density'\) return n\.toFixed\(3\)/, '密度用 toFixed(3)')
  assert.match(dlg, /kind === 'weight'\) return n\.toFixed\(2\)/, '重量用 toFixed(2) 补零')
  assert.match(dlg, /kind === 'len2'\) return n\.toFixed\(2\)/, '长度用 toFixed(2) 补零')
})

test('只读态给「%」列补百分号，编辑态不补', () => {
  assert.match(sheet, /function needsPercentSuffix/, '缺百分比判定')
  assert.match(sheet, /function readCellText/, '缺只读格文本函数')
  // 只读渲染必须走 readCellText（编辑态是 el-input，不经过它）
  assert.match(sheet, /\{\{ readCellText\(c, row\[c\.key\]\) \|\| ' \/ ' \}\}/, '只读格必须走 readCellText')
  // 不能把 % 塞进输入框
  assert.doesNotMatch(sheet, /v-model="row\[c\.key\]"\s*[^>]*%.*%/, '输入框不得拼 %')
})

test('回填必须过滤掉没有物料的行（用户 2026-11-18 口径）', () => {
  // 「写了在配方计算回填的时候没有数据的行自己去掉，怎么现在还有显示的」
  //   ⇒ detail 只写 物料编号/物料名称 任一非空的行，序号按输出顺序重排。
  assert.match(dlg, /\.filter\(\(\{ r \}\) => String\(r\.code \|\| ''\)\.trim\(\) !== '' \|\| String\(r\.name \|\| ''\)\.trim\(\) !== ''\)/,
    '要按 物料编号/物料名称 过滤')
  assert.match(dlg, /序号: String\(i \+ 1\)/, '过滤后序号按输出顺序重排')
  assert.match(dlg, /c\.rows\[idx\]/, '取计算结果要用**过滤前**的原始下标')
})

test('回填替换按引用判定，不再依赖行对象上的「表区」', () => {
  // 2026-11-18 用户截图：回填后每行出现两次（1,1,2,2,3,3,4,4）——
  // 原实现按 r[filterKey] 比对，而行对象不一定带该键 ⇒ 旧行被留下再追加 = 翻倍。
  const sheet = readFileSync(new URL('../views/RecordSheetPanels.vue', import.meta.url), 'utf8')
  const at = sheet.indexOf('function onXSinterApplied')
  assert.ok(at > 0, '缺 onXSinterApplied')
  const seg = sheet.slice(at, at + 1400)
  assert.match(seg, /const mine = new Set\(rowsOf\(dt\)\)/, '要用 rowsOf(dt) 的引用集合判定本表行')
  assert.match(seg, /arr\.filter\(\(r\) => !mine\.has\(r\)\)/, '按引用剔除旧行')
})
