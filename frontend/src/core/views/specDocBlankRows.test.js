import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/**
 * 规格书「检验项目」不能编辑(2026-11-04 用户报障):
 *   「产品规格书的填写过程中,在草稿状态的时候就是不能编辑检验项目这个格的内容」
 *
 * 根因:页 2「产品性能检验项目及检验标准」这张明细表**没有配置 blankRows**。
 *   组件里铺空行的机制(RecordSheetPanels 的 blankRows watch)只对声明了
 *   `blankRows > 0` 的表生效 ⇒ 新建草稿这一页一行都没有 ⇒ 纸面只有一个「—」,
 *   没有任何输入框可点。用户看到的就是"检验项目不能编辑",只能靠「⧉ 从标准库勾选」
 *   批量灌行,想手填一行明细没有办法。
 *
 * 同一份代码里成型工艺清单(RD_MOLD_PROC)的配方表就配了空白行:
 *   `autoSeqBar: true, blankRows: 10`(2026-10-30 用户口径「这个面板也是默认10行带序号的」)。
 * 规格书这张表是同一种"人录明细"的表,应当同一套处置。
 *
 * 这条测试钉三件事:
 *   ① 规格书检验项目表必须声明 blankRows(否则草稿无行可编);
 *   ② 同时声明 autoSeqBar —— 少了它铺出的行没有序号,纸上「序号」列一片空白;
 *   ③ 铺行不得带任何假数据(只允许 表区 + 序号),否则用户会以为系统已经给了检验项。
 */

/** 按 filterVal 取某面板的明细表配置(recordSheetConfigs 的 dataTables) */
function dtOf(panel, filterVal) {
  const list = recordSheetConfigs[panel]?.dataTables || []
  return list.find((d) => d.filterVal === filterVal)
}

test('规格书「检验项目」表存在且按 表区=检验要求 分块', () => {
  const dt = dtOf('RD_SPEC_DOC', '检验要求')
  assert.ok(dt, 'RD_SPEC_DOC 应有 filterVal=检验要求 的明细表')
  assert.equal(dt.filterKey, '表区')
  assert.equal(dt.page, 2, '它应在第 3 页(索引 2)= 检验项目及标准')
})

test('规格书「检验项目」表必须铺默认空行(否则草稿状态无行可编)', () => {
  const dt = dtOf('RD_SPEC_DOC', '检验要求')
  const n = Number(dt.blankRows) || 0
  assert.ok(n > 0,
    `blankRows 应为正数(现在 ${JSON.stringify(dt.blankRows)}) —— 0/未配 = 新建草稿这一页没有可编辑的行`)
})

test('铺的行必须带序号(autoSeqBar)', () => {
  const dt = dtOf('RD_SPEC_DOC', '检验要求')
  assert.equal(dt.autoSeqBar, true,
    'blankRows 铺行时只有 autoSeqBar=true 才会写「序号」;少了它纸上序号列全空')
})

test('默认行数与成型工艺清单配方表取同一口径(不各说各话)', () => {
  const spec = dtOf('RD_SPEC_DOC', '检验要求')
  const mold = dtOf('RD_MOLD_PROC', '配方表')
  assert.ok(Number(mold.blankRows) > 0, '前置:成型工艺清单配方表本就有默认行')
  assert.equal(Number(spec.blankRows), Number(mold.blankRows),
    `规格书检验项目 ${spec.blankRows} 行 vs 成型配方表 ${mold.blankRows} 行,口径应统一`)
})

test('铺行不带假数据(不许预填检验项目/检验要求示例文本)', () => {
  const dt = dtOf('RD_SPEC_DOC', '检验要求')
  // 组件铺行只写 filterKey 那一列 + 序号;配置若额外给了 seedRows/默认值,
  // 就会把"示例检验项"当成真数据写进每一张新单。
  assert.ok(!dt.seedRows, '不应有 seedRows(那是面板级铺行的另一套机制)')
  assert.ok(!dt.defaultRow, '不应有 defaultRow(会预填假检验项)')
})

test('对照组:成型工艺清单配方表的口径未被改动(钉子,防误伤)', () => {
  const mold = dtOf('RD_MOLD_PROC', '配方表')
  assert.equal(mold.blankRows, 10)
  assert.equal(mold.autoSeqBar, true)
})
