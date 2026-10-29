import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * prodInfoSheetKeys.test.js — 钉住「产品信息表」纸面的数据键口径(2026-10-16 用户报障)
 *
 * 用户原话:「我填写的产品信息表的主要性能描述和审批人那些信息保存都不见了」。
 * 根因:接口行契约的键是 **yj_field.label**(QueryService.rowToLabels),而 RD_PROD_INFO 纸面配置里
 *   这几格的 `key` 写的是**物理列名**(特殊性能描述 / 审核人一级 / 审核人二级 / 责任人):
 *     · 读 `head['特殊性能描述']` 取不到(label 键是 主要性能描述)⇒ 界面永远空白;
 *     · 写的时候后端不认识这些列名 ⇒ **静默丢弃**,库里真值一直 NULL。
 * 实测(服务器 PI-2026-10-0007):主要性能描述=NULL(丢了);审核人一级/二级、责任人 由审批流写库
 *   (冯总 / 陈秀丽 / admin)但纸面读不到 ⇒ 用户看到的"审批人也不见了"是读的问题,同一根因。
 *
 * 本测按源码钉住:这 4 格的 key 必须等于 label,且不许再出现那几个物理列名。
 */
const src = readFileSync(new URL('./recordSheetConfigs.js', import.meta.url), 'utf8')
const start = src.indexOf('RD_PROD_INFO: {')
const block = src.slice(start, src.indexOf('\n  RD_', start) + 1 || undefined)

test('RD_PROD_INFO 纸面:主要性能描述 / 两级审批人 / 产品负责人 的 key 必须是 label', () => {
  for (const label of ['主要性能描述', '审核人（一级审批人）', '审核人（二级审批人）', '产品负责人']) {
    assert.ok(
      block.includes(`key: '${label}'`),
      `${label} 的 key 必须等于 label(接口行契约是 label;写物理列名会被后端静默丢弃)`,
    )
  }
})

/**
 * 2026-10-29 起:两级审批人的**纸面文案**照新版设计改成「审核人（一级审核）」/「二级审核」,
 * 而 key 仍是 yj_field.label「审核人（一级审批人）」。
 * ⇒ 上面那条断言只认 key(不再要求 label===key 的字面相邻),这里补一条:
 *   显示文案改了也要真的改(否则设计改动静默丢失),且不得把显示文案当成 key。
 */
test('RD_PROD_INFO 纸面:两级审批人显示文案按新设计改,key 仍指向 label', () => {
  assert.ok(block.includes("{ label: '审核人（一级审核）', key: '审核人（一级审批人）'"),
    '一级审核那一行的显示文案应为「审核人（一级审核）」,key 仍是「审核人（一级审批人）」')
  assert.ok(block.includes("{ label: '审核人（二级审核）', key: '审核人（二级审批人）'"),
    '二级审核同理')
  // 反面:不能把新文案直接当 key(纸面文案不是数据键)
  assert.ok(!block.includes("key: '审核人（一级审核）'"), '显示文案不能当数据键')
})

test('RD_PROD_INFO 纸面不许再出现这四个物理列名当 key', () => {
  for (const col of ['特殊性能描述', '审核人一级', '审核人二级', '责任人']) {
    assert.ok(!block.includes(`key: '${col}'`), `${col} 是物理列名,不能当数据键`)
  }
})
