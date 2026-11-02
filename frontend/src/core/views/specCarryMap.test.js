/**
 * specCarryMap.test.js —— 规格书封面「引用产品信息表」时，哪些字段能带回来
 *
 * 【用户报障 2026-11-02】
 *   「服务器上的产品信息表的应用场景以及其他字段不能在规格书中带入」
 *   截图：产品信息表 0341654 填了 应用场景=ccccs台面机；引用到规格书后封面那格还是空。
 *
 * 【根因】
 *   `recordSheetConfigs.RD_SPEC_DOC.prodPick.map` 是"带哪些字段"的唯一清单，
 *   它只列了 7 项，**漏了 应用场景**；旁边的注释还写着「产品信息表没有该列(rd_prod_info_head 无此字段)」——
 *   这句在写的时候也许是对的，但 2026-10-30 的 migrate-prodinfo-head-extra 已经把
 *   项目编号/项目名称/客户名称/应用场景 四列补进了表，注释与实现都没跟上。
 *   于是"封面有这一行、源表有这一列、中间 map 没写" ⇒ 引用后永远是空，且不报错。
 *
 * 【为什么钉成测试】
 *   这类缺陷**没有报错**：字段少一个只是"那格空着"，看起来像用户没填。
 *   而"封面加了一行、忘了写进 map"会反复发生。所以判据不是"应用场景在不在"，
 *   而是：**封面每个字段，要么有来源，要么被明确登记为"产品信息表里没有"**。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { recordSheetConfigs } from './recordSheetConfigs.js'

const spec = recordSheetConfigs.RD_SPEC_DOC
const coverKeys = spec.cover.fields.map((f) => f.key)
const mappedTo = new Set((spec.prodPick.map || []).map((m) => m.to || m.from))

/**
 * 封面字段里**产品信息表确实没有来源**的，必须在这里写明理由。
 * 加字段的人要么去 map 里补一条，要么来这儿写清楚为什么补不了。
 */
const NO_SOURCE = {
  版本: '产品信息表没有「版本」列；规格书的版本是它自己的修订版本，不该跟着产品走',
}

test('封面每个字段：要么有 prodPick.map 来源，要么在"确实没来源"清单里登记理由', () => {
  const missing = coverKeys.filter((k) => !mappedTo.has(k) && !(k in NO_SOURCE))
  assert.deepEqual(missing, [],
    `这些封面字段既没有来源也没登记理由：${missing.join('、')}` +
    '（封面加了行却忘了进 prodPick.map ⇒ 引用产品信息表后那格永远空白，而且不报错）')
})

test('应用场景 必须能从产品信息表带入（2026-11-02 用户报障的那一格）', () => {
  const m = (spec.prodPick.map || []).find((x) => (x.to || x.from) === '应用场景')
  assert.ok(m, '封面第 6 行是「应用场景」，产品信息表 rd_prod_info_head 也有这一列 ⇒ 必须映射')
  assert.equal(m.from, '应用场景', '同名列直接对拷，不要绕')
})

test('map 的 from 必须是产品信息表真实字段（拼错就是静默取到 undefined）', () => {
  // 这些是 RD_PROD_INFO 的 yj_field.label（含已知的跨名：特殊性能描述 → 产品主要性能）
  const PROD_INFO_LABELS = new Set([
    '产品编号', '产品名称', '产品类别', '产品类型', '客户料号', '客户名称', '客户项目名称',
    '项目编号', '项目名称', '立项文档编号', '产品管控等级', '产品功能类别', '应用场景',
    '产品整体尺寸', '炭棒尺寸', '炭棒外径', '炭棒内径', '炭棒长度', '主要性能描述',
    '下单数量', '产品分类', '产品形态', '客户图纸或规格书', '产品负责人', '备注',
  ])
  // from 允许是数组（按序取第一个非空），逐个来源都要是真实字段
  for (const m of spec.prodPick.map) {
    for (const f of (Array.isArray(m.from) ? m.from : [m.from])) {
      assert.ok(PROD_INFO_LABELS.has(f), `prodPick.map 的来源字段「${f}」不在产品信息表的字段里（拼错 ⇒ 永远取到空）`)
    }
  }
})

test('客户（项目）名称 两列都要认（客户项目名称空时回落客户名称）', () => {
  const m = (spec.prodPick.map || []).find((x) => (x.to || x.from) === '客户项目名称')
  assert.ok(m, '封面「客户（项目）名称」必须映射到 RD_SPEC_DOC 的 客户项目名称')
  assert.deepEqual(m.from, ['客户项目名称', '客户名称'],
    '产品信息表把客户/项目分两列；封面是一格 ⇒ 按 [客户项目名称, 客户名称] 顺序取第一个非空')
})
