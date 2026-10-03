/**
 * wo-qr.test.js — 工单二维码内容规则单测(2026-10-09 规则改版)
 * 规则:公司代码@工单号@(1000+工单行号),行号 3 位不足补 0;例 0@GD2608100001@1003。
 * 旧规则(工单号|批号|产品编码|排产数量|生产线)作废;扫码报工/领料按新口径解析。
 * 运行:npm test(node --test);打印冒烟走 qrcode 库真实出图,mock window 捕获打印 HTML。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const captured = { html: '' }
const fakeDoc = {
  write(html) { captured.html += String(html) },
  close() { /* noop */ },
}
globalThis.window = { open: (_u, _t) => { captured.html = ''; return { document: fakeDoc } } }
globalThis.alert = () => { throw new Error('不应触发拦截告警') }

const { woQrText, printWorkTaskSheet } = await import('./print-formats.js')

test('规则:公司代码@工单号@1000+行号(行号3位补0)', () => {
  assert.equal(woQrText({ 公司代码: '0', 工单号: 'GD2608100001', 工单行号: 3 }), '0@GD2608100001@1003')
  assert.equal(woQrText({ 公司代码: '0', 工单号: 'GD2608100001', 工单行号: 25 }), '0@GD2608100001@1025')
  assert.equal(woQrText({ 公司代码: '0', 工单号: 'GD2608100001', 工单行号: '7' }), '0@GD2608100001@1007')
})

test('缺省:行号缺省按 1(单行工单);公司代码空缺省 0(plang.comm);单据编号/加工单号 兜底取号', () => {
  assert.equal(woQrText({ 工单号: 'GD2608100001' }), '0@GD2608100001@1001')
  assert.equal(woQrText({ 单据编号: 'GD2608100001' }), '0@GD2608100001@1001')
  assert.equal(woQrText({ 加工单号: 'GD2608100001', 公司代码: ' ' }), '0@GD2608100001@1001')
})

test('打印冒烟:成型生产任务单行尾二维码按新规则真实出图', async () => {
  const ok = await printWorkTaskSheet('成型生产任务单', [{
    单据编号: 'GD2608100001', 公司代码: '0', 工单行号: 3,
    是否重点管控产品: '否', 商品编码: 'P001', 商品名称: '滤芯', 规格型号: '2-3mm',
    订单数量: 100, 成型折算后数量: 95, 计划完工日期: '2026-10-09',
    批号: 'L001', 物料编码: 'P001', 排产数量: 95, 生产线: '1线',
  }])
  assert.equal(ok, true)
  assert.match(captured.html, /data:image\/png/, '行尾二维码应生成 data URL')
  assert.ok(captured.html.includes('GD2608100001'), '工单号应出现在单面')
})
