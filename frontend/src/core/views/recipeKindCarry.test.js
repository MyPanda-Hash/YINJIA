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
