/**
 * asmBomColumns.test.js —— 组装工艺清单「组装BOM表」去掉「外观要求」列,且上下同宽
 *
 * 【用户口径 2026-10-28 截图《组装工艺控制-BOM表》】
 *   ①「把这个面板表格的外观那一列去掉不需要了」
 *   ②「表格调整对齐表格宽度，也可以同时调整上边宽度，不单单是调整下边的，这样子观感会好一点」
 *
 * ② 守的是一个**改配置不报错、但一打开就难看**的坑:
 *   BOM 表的列自带 w ⇒ `dtOwnsWidth(dt)` 为真 ⇒ 该表用自己的 colgroup,
 *   宽度 = **各列 w 之和**,不再跟全页网格(grid)走(见 RecordSheetPanels.vue:2673 与模板 :496-503)。
 *   ⇒ 删掉一列却不把腾出来的宽度分回其余列,下边那张表就比上边(报告头 + 产品基本信息)短一截,
 *     右缘对不上、整页右边空出一块。
 *   这条把「可见列宽之和 == 本页 grid 之和(上下同宽)」钉死。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_ASM_PROC
const PAGE = 1 // 页签 1 = 组装BOM表(0 修订记录 / 1 组装BOM表 / 2 组装工艺清单)
const bom = () => (cfg?.dataTables || []).find((d) => d.filterVal === '物料清单')
/** 可见列 = cols 里去掉 hiddenCol(表区是物理列,不上面) */
const visCols = () => (bom()?.cols || []).filter((c) => !c.hiddenCol)
const pageGrid = () => cfg?.pages?.[PAGE]?.grid || cfg?.grid || []

test('组装BOM表:不再有「外观要求」列(用户口径:不需要了)', () => {
  assert.ok(bom(), '找不到组装BOM表(dataTables 里 filterVal=物料清单 那一张)')
  const keys = visCols().map((c) => c.key)
  assert.ok(!keys.includes('外观要求'),
    `组装BOM表还在画「外观要求」列(当前列: ${keys.join(' | ')})`)
})

test('组装BOM表:删列后可见列宽之和 = 本页 grid 之和(否则下边比上边窄一截)', () => {
  const visSum = visCols().reduce((s, c) => s + (c.w || 100), 0)
  const gridSum = pageGrid().reduce((s, w) => s + w, 0)
  assert.ok(gridSum > 0, '第 1 页没有 grid(条件区会塌成 0 宽)')
  assert.equal(visSum, gridSum,
    `上下不同宽:表体可见列宽之和 ${visSum} ≠ 本页 grid 之和 ${gridSum}` +
    '(BOM 表自带列宽 colgroup,不铺满就比上边短)')
})

test('组装BOM表:每列都给了正的列宽(缺省会退回 100,列宽就不是设计值了)', () => {
  for (const c of visCols()) {
    assert.ok(Number(c.w) > 0, `列 '${c.key}' 没有正列宽`)
  }
})
