/**
 * print-formats.test.js — printProductCards 卡面渲染单测(2026-09-28,采购入库单·打印标识卡)
 * 口径:
 *  ① 单据行多带可选键(订单编号/供应商名称/数量/批次/生产日期)时卡面填充事实值;
 *  ② 商品档案旧调用(只传 编码/规格)行为不变——可选键留空(空 <span class="v">)手填;
 *  ③ 二维码内容=公司代码@物料编码[@批号](2026-09-28 旧系统扫码口径:带批号三段/不带两段,规格·数量不进码),
 *     由导出的 productCardQrText 直接断言;卡面 img data:image/png 仍由 qrcode 库真实生成;
 *  ④ 2026-09-28 flex 版式:标签 .lb 恒不折行,值区 .v word-break:break-all 过长自动转行,空值保留 22mm 手填横线。
 * 运行:npm test(node --test)——mock window/document 捕获打印 HTML,不起浏览器。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const captured = { title: '', html: '' }
const fakeDoc = {
  write(html) { captured.html += String(html) },
  close() { /* noop */ },
}
globalThis.window = { open: (_u, _t) => { captured.html = ''; return { document: fakeDoc } } }
globalThis.alert = () => { throw new Error('不应触发拦截告警') }

const { printProductCards, productCardQrText } = await import('./print-formats.js')

test('单据行(带可选键):订单编号/供应商/数量/批次/生产日期填充进卡面', async () => {
  const sent = await printProductCards([{
    编码: 'Y-CSA-23', 规格: '2-3mm', 数量: 11, 批次: '20260928',
    订单编号: 'YJ-20260921-05', 供应商名称: '淄博宗立新材料科技有限公司', 生产日期: '2026-09-21',
  }])
  assert.equal(sent, true)
  const html = captured.html
  assert.ok(html.includes('YJ-20260921-05'), '订单编号应出现在卡面')
  assert.ok(html.includes('淄博宗立新材料科技有限公司'), '供应商名称应出现在卡面')
  assert.ok(html.includes('Y-CSA-23'), '物料编码取自 编码 键')
  assert.ok(html.includes('2-3mm'), '物料规格取自 规格 键')
  assert.ok(html.includes('20260928'), '批次填充')
  assert.ok(html.includes('2026-09-21'), '生产日期填充')
  // 数量 11 在卡面(避免误命中二维码 data URL 里的随机串,用带标签上下文断言;flex 版式=标签 .lb 包裹)
  assert.ok(/数　　量：<\/span><span class="v">11/.test(html), '数量填充')
  assert.ok(/data:image\/png/.test(html), '二维码应生成 data URL')
  // 二维码内容(2026-09-28 旧系统扫码口径):带批号=公司代码@物料编码@批号
  assert.equal(productCardQrText({ 编码: 'XH-SX80250SX', 批次: '20060908' }), '0@XH-SX80250SX@20060908', '带批号三段式')
  // flex 版式注入:值区可转行(2026-09-28 供应商名称过长溢出卡边的修正)
  assert.ok(html.includes('word-break:break-all'), '.v 值区应带 word-break:break-all(过长自动转行)')
  assert.ok(/class="lb">供应商名称：/.test(html), '字段标签应包 .lb(恒不折行)')
})

test('商品档案旧调用(仅 编码/规格):可选键留空手填,行为不变', async () => {
  const sent = await printProductCards([{ 编码: 'YJ-TS-004', 规格: '44.1*28.7*215.5' }])
  assert.equal(sent, true)
  const html = captured.html
  assert.ok(html.includes('YJ-TS-004'), '物料编码仍在')
  assert.ok(/订单编号：<\/span><span class="v"><\/span>/.test(html), '订单编号留空(横线手填)')
  assert.ok(/数　　量：<\/span><span class="v"><\/span>/.test(html), '数量留空')
  assert.ok(/批　　次：<\/span><span class="v"><\/span>/.test(html), '批次留空')
  assert.ok(!html.includes('undefined'), '不得漏出 undefined')
  // 二维码内容:不带批号(商品档案行)=公司代码@物料编码 两段式
  assert.equal(productCardQrText({ 编码: 'XH-SX80250SX' }), '0@XH-SX80250SX', '不带批号两段式')
})

test('过长值(45字供应商/长规格):完整输出不断链,由 CSS 折行兜底', async () => {
  const long = '深圳市陶氏水处理设备技术开发有限公司惠州分公司第一事业部'
  const sent = await printProductCards([{ 编码: 'YJ-TS-004', 规格: '44.1*28.7*215.5', 供应商名称: long }])
  assert.equal(sent, true)
  const html = captured.html
  assert.ok(html.includes(long), '超长供应商名称应完整输出(折行交给 CSS word-break)')
  assert.ok(!html.includes('undefined'), '不得漏出 undefined')
})

test('空行/无编码行:直接返回 false,不开打印窗', async () => {
  assert.equal(await printProductCards([]), false)
  assert.equal(await printProductCards([{ 规格: '无编码行' }]), false)
})
