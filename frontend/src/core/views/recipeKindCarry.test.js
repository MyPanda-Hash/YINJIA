/**
 * recipeKindCarry.test.js —— 成型工艺清单页 2「配方表」物料格的两条钉子
 *
 * 【用户口径 2026-10-16】原话:
 *   「在成型工艺清单填写配方表的物料信息的时候,手动填写物料编码应该带出对应的物料类别以及
 *     物料名称,把填写框的物料种类的下拉框改为普通文本框」
 *
 * 实测背景(HSDZ_MES.bs_inv):YJ-LL-003 → 存货名称 胶粉 / 所属类别 胶粉;
 *   YJ-SLD-012 → 超高分子量聚乙烯 / 所属类别 胶粉。
 *   那两格的档案数据本来就在返回行里,只是旧链路只写对侧那一格 ⇒ 物料种类 一直空着。
 *
 * 纯函数的判据在 core/panel/invCarry.test.js(pickInvKind);这里钉的是"接线"——
 *   ① 配置层:那格不许再是下拉;② 页面层:确实把种类写回该行(纯函数对但没人调 = 功能没做)。
 * 单测跑不了模板,@vue 编译产物也不进 node --test,故按仓库既有做法读源码钉住(同 rdChangeConfig.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const panel = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')

const formulaTable = () => recordSheetConfigs.RD_MOLD_PROC.dataTables.find((d) => d.filterVal === '配方表')

test('配方表「物料种类」是普通文本格(不再 type=select / 不再带 options 词表)', () => {
  const col = (formulaTable().cols || []).find((c) => c.key === '物料种类')
  assert.ok(col, '配方表缺 物料种类 列')
  assert.notEqual(col.type, 'select', '物料种类 不许再是下拉(用户要求改普通文本框)')
  assert.equal(col.options, undefined, '下拉词表已撤 —— 种类由 物料编号 从商品档案带出')
  assert.equal(col.span, 2, '跨度不变(版式不动)')
})

test('页 2 配方表把 物料种类 与对侧格一并带出(接线在 onDetailTextCommit)', () => {
  assert.match(panel, /pickInvKind/, '页面必须调用 pickInvKind(只写对侧那一格 = 用户看到的老毛病)')
  assert.match(panel, /row\['物料种类'\]\s*=/, '带出的种类要写回该行')
})

/* ── 物料编号「边填边模糊筛」(2026-10-16 用户口径)──────────────────────────────
   原话:「物料编号可以在填写的时候模糊筛选下拉显示提供选择,比如 YJ-LL-003,
          可以在输入 Y 或者 003 时模糊搜索到含这些数字字母的」。
   那格从普通文本框换成**远程筛选下拉**:打字才联网、候选封顶 50、allow-create 保留手打。
   纯函数判据(invSearchRequest / invSearchOptions)在 panel/invCarry.test.js 与
   mold/recipeKindFilter.test.js;这里钉配置与接线(纯函数对但没接上 = 功能没做)。 */
test('配方表「物料编号」改为商品档案远程筛选下拉(inv-code)', () => {
  const col = (formulaTable().cols || []).find((c) => c.key === '物料编号')
  assert.ok(col, '配方表缺 物料编号 列')
  assert.equal(col.type, 'inv-code', '物料编号 要声明成远程筛选下拉(否则还是只能手打)')
  assert.equal(col.span, 4, '跨度不变(版式不动)')
})

test('远程筛选接线:fetch-suggestions → fetchInvCodes,候选走 invSearchOptions,且手打的编码不会被吞', () => {
  assert.match(panel, /<el-autocomplete/, '用 el-autocomplete:输入框本身就是值 ⇒ 档案里没有的新编码手打后不会被吞')
  assert.match(panel, /fetch-suggestions="\(q, cb\) => fetchInvCodes\(row, q, cb\)"/, '缺远程建议接线(打字不会联网)')
  assert.match(panel, /invSearchOptions\(/, '候选必须走 recipeRows.invSearchOptions(子串匹配、去重、封顶 OPTION_CAP)')
  assert.match(panel, /invSearchRequest\(/, '请求体走 invCarry.invSearchRequest(空关键字不给发)')
  assert.match(panel, /@select="\(item\) => onInvCodePick\(row, c\.key, item\)"/, '选中后要带出 物料名称/物料种类')
})
