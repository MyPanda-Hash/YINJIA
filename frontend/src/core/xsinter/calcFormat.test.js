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

test('落库格式按列语义分精度（ratio/piece/weight 2 位、length 1 位）', () => {
  const at = dlg.indexOf('const fmt = (v, kind')
  assert.ok(at > 0, 'fmt 必须接收 kind 参数')
  const seg = dlg.slice(at, at + 900)
  assert.match(seg, /kind === 'length'.*Math\.round\(n \* 10\)/, '长度类 1 位小数')
  assert.match(seg, /kind === 'ratio' \|\| kind === 'piece' \|\| kind === 'weight'.*Math\.round\(n \* 100\)/,
    '比例/单支含量/重量 2 位小数')
})

test('关键列必须真的用上新精度', () => {
  assert.match(dlg, /添加比例: fmt\(percentOf\(actual\), 'ratio'\)/, '添加比例要 2 位')
  assert.match(dlg, /'单支含量g': fmt\(c\.rows\[i\]\?\.perPiece, 'piece'\)/, '单支含量要 2 位')
  assert.match(dlg, /'炭棒重量下限g': fmt\(c\.weight\.low, 'weight'\)/, '炭棒重量要 2 位')
  assert.match(dlg, /'切炭长度中间值mm': fmt\(c\.cut\.mid, 'length'\)/, '切炭长度 1 位')
})

test('只读态给「%」列补百分号，编辑态不补', () => {
  assert.match(sheet, /function needsPercentSuffix/, '缺百分比判定')
  assert.match(sheet, /function readCellText/, '缺只读格文本函数')
  // 只读渲染必须走 readCellText（编辑态是 el-input，不经过它）
  assert.match(sheet, /\{\{ readCellText\(c, row\[c\.key\]\) \|\| ' \/ ' \}\}/, '只读格必须走 readCellText')
  // 不能把 % 塞进输入框
  assert.doesNotMatch(sheet, /v-model="row\[c\.key\]"\s*[^>]*%.*%/, '输入框不得拼 %')
})
