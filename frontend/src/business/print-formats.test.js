/**
 * print-formats.test.js — printProductCards 卡面渲染单测(2026-09-28,采购入库单·打印标识卡)
 * 口径:
 *  ① 单据行多带可选键(订单编号/供应商名称/数量/批次/生产日期)时卡面填充事实值;
 *  ② 商品档案旧调用(只传 编码/规格)行为不变——可选键留空(空 <span class="v">)手填;
 *  ③ 二维码内容=公司代码@物料编码[@批号](2026-09-28 旧系统扫码口径:带批号三段/不带两段,规格·数量不进码),
 *     由导出的 productCardQrText 直接断言;卡面 img data:image/png 仍由 qrcode 库真实生成;
 *  ④ 2026-09-28 flex 版式:标签 .lb 恒不折行,值区 .v word-break:break-all 过长自动转行,空值保留 22mm 手填横线。
 *  ⑤ 2026-09-28 库位标识卡(printLocationCards):同款 75×100mm,卡面=仓库/库位地址/库位编码(不含商品字段),
 *     二维码=仓库@库位地址@库位编码 固定三段(locationCardQrText 直接断言)。
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

const { printProductCards, productCardQrText, printPuOrder, printPuOrderNoAmount, printLocationCards, locationCardQrText } = await import('./print-formats.js')

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

// ═══ 库位标识卡(WHLOC 库位档案「二维码标签」,2026-09-28):同款 75×100mm 版式,卡面只放库位字段 ═══

test('库位标识卡:卡面=仓库/库位地址/库位编码,二维码=仓库编码@库位地址@库位编码(固定三段)', async () => {
  const sent = await printLocationCards([{ 仓库: '原料仓', 仓库编码: 'CK01', 库位地址: 'A区3排2层', 库位编码: 'KW-0001' }])
  assert.equal(sent, true)
  const html = captured.html
  assert.ok(/class="lb">仓　　库：/.test(html), '仓库字段标签(四字对齐)')
  assert.ok(/仓　　库：<\/span><span class="v">原料仓/.test(html), '仓库值填充')
  assert.ok(/库位地址：<\/span><span class="v">A区3排2层/.test(html), '库位地址填充')
  assert.ok(/库位编码：<\/span><span class="v">KW-0001/.test(html), '库位编码填充')
  assert.ok(/data:image\/png/.test(html), '二维码应生成 data URL')
  // 卡面不含商品标识卡字段(用户口径:库位卡只服务定位)
  for (const absent of ['订单编号', '供应商名称', '物料编码', '物料规格', '数　　量', '批　　次', '生产日期'])
    assert.ok(!html.includes(absent), `卡面不得出现商品字段:${absent}`)
  // 二维码内容:固定三段,顺序 仓库编码@库位地址@库位编码(2026-09-28 改版:首段 仓库→仓库编码)
  assert.equal(locationCardQrText({ 仓库: '原料仓', 仓库编码: 'CK01', 库位地址: 'A区3排2层', 库位编码: 'KW-0001' }),
    'CK01@A区3排2层@KW-0001', '三段式(首段=仓库编码,不是仓库名称)')
  assert.equal(locationCardQrText({ 仓库: '原料仓', 库位地址: 'A区3排2层', 库位编码: 'KW-0001' }),
    '@A区3排2层@KW-0001', '无仓库编码=空首段(仓库名称不进二维码)')
})

test('库位二维码:空段保留占位(缺地址=编码@@库位码),不静默丢段', () => {
  assert.equal(locationCardQrText({ 仓库编码: 'CK02', 库位编码: 'KW-09' }), 'CK02@@KW-09')
})

test('库位标识卡:空行/无编码行 直接返回 false', async () => {
  assert.equal(await printLocationCards([]), false)
  assert.equal(await printLocationCards([{ 仓库: '原料仓', 库位地址: '无编码行' }]), false)
})

const PU_DOC = {
  单据编号: 'PO-2026-09-0001', 单据日期: '2026-09-28', 供应商编码: 'GYS001',
  供应商: '深圳市陶氏水处理设备技术开发有限公司', 付款方式: '月结30天',
}
const PU_LINES = [
  { 物料编码: 'M-001', 物料名称: '物料A', 规格型号: 'Φ20', 单价: 1.5, 单位: '支', 数量: 10, 金额: 15, 预计到货日期: '2026-10-01', '税率%': 13, 备注: '' },
  { 物料编码: 'M-002', 物料名称: '物料B', 规格型号: 'Φ25', 单价: 2, 单位: '支', 数量: 5, 金额: 10, 备注: '加急' },
]

test('打印订单无金额:采购订单另一种报表,仅去 单价/小计/总计金额(2026-09-28 用户澄清)', () => {
  printPuOrderNoAmount(PU_DOC, PU_LINES)
  const html = captured.html
  // 版式与订单完全同款:标题/信息区(付款方式/是否含税)/注意事项/签章框
  assert.ok(html.includes('<h1>银嘉采购订单</h1>'), '标题=银嘉采购订单(同款)')
  assert.ok(html.includes('付款方式') && html.includes('是否含税'), '信息区与订单一致')
  assert.ok(html.includes('注意事项：'), '注意事项块')
  assert.ok(html.includes('供　方') && html.includes('需　方'), '供/需方签章框')
  // 仅去金额:单价/小计列不出现,交期要求列保留;总计仅数量合计(10+5=15)
  assert.ok(!html.includes('<th>单价</th>'), '不得有单价列')
  assert.ok(!html.includes('<th>小计</th>'), '不得有小计列')
  assert.ok(html.includes('<th>交期要求</th>'), '交期要求列保留(同订单)')
  assert.ok(html.includes('加急'), '备注列')
  assert.ok(/总　计<\/td><td class="r">15<\/td><td><\/td><td><\/td>/.test(html), '总计=仅数量合计(15),无金额单元格')
})

test('打印采购订单回归:抽取公共版式块后仍保留金额列(输出不变)', () => {
  printPuOrder({
    单据编号: 'PO-2026-09-0001', 单据日期: '2026-09-28', 供应商编码: 'GYS001',
    供应商: '某供应商', 付款方式: '月结30天',
  }, [{ 物料编码: 'M-001', 物料名称: '物料A', 规格型号: 'Φ20', 单价: 1.5, 单位: '支', 数量: 10, 金额: 15, '税率%': 13, 备注: '' }])
  const html = captured.html
  assert.ok(html.includes('<h1>银嘉采购订单</h1>'), '订单标题不变')
  assert.ok(html.includes('<th>单价</th>') && html.includes('<th>小计</th>'), '订单版式仍含单价/小计列')
  assert.ok(html.includes('是否含税'), '订单版式仍含是否含税')
  assert.ok(html.includes('付款方式'), '订单版式仍含付款方式')
})
