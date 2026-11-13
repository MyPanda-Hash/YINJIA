/**
 * print-formats.test.js — printProductCards 卡面渲染单测(2026-09-28,采购入库单·打印标识卡)
 * 口径:
 *  ① 单据行多带可选键(订单编号/供应商名称/数量/批次/生产日期)时卡面填充事实值;
 *  ② 商品档案旧调用(只传 编码/规格)行为不变——可选键留空(空 <span class="v">)手填;
 *  ③ 二维码内容=公司代码@物料编码[@批号](2026-09-28 旧系统扫码口径:带批号三段/不带两段,规格·数量不进码),
 *     由导出的 productCardQrText 直接断言;卡面 img data:image/png 仍由 qrcode 库真实生成;
 *  ④ 2026-09-28 flex 版式:标签 .lb 恒不折行,值区 .v word-break:break-all 过长自动转行,空值保留 22mm 手填横线。
 *  ⑤ 仓位标识卡(printLocationCards;2026-09-28 建为库位卡,2026-10-08 库位→仓位术语统一):
 *     同款 75×100mm,卡面=仓库/仓位地址/仓位编码(不含商品字段),
 *     二维码=仓库编码@仓位编码 固定两段(2026-10-18 去地址段;locationCardQrText 直接断言)。
 * ⚠ 2026-10-20:全部版式从**子窗口打印**(window.open + document.write)改成**页面内打印层**
 *   (`@core/panel/printChannel`)。所以这里改成 mock document/body 并抓 `#yj-print-host` 的 innerHTML;
 *   同时**故意不提供 window.open** —— 谁再往回写弹窗打印,单测立刻 TypeError。
 * 运行:npm test(node --test)——mock window/document 捕获打印 HTML,不起浏览器。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const captured = { html: '', printed: 0 }
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '', style: {},
    children: [],
    appendChild(child) {
      this.children.push(child)
      if (child && child.id === 'yj-print-host') captured.html = child.innerHTML
      return child
    },
    remove() { /* noop */ },
  }
}
const head = makeEl('head')
const body = makeEl('body')
// document.title 赋值记录(2026-11-04):打印通道会临时改浏览器标题当作打印页眉/PDF 默认文件名,
// 排单计划要求它随工序产线变 —— 这里记下每一次赋值供断言。
const documentTitleLog = []
let documentTitle = ''
globalThis.document = {
  get title() { return documentTitle },
  set title(v) { documentTitle = String(v ?? ''); documentTitleLog.push(documentTitle) },
  head, body,
  createElement: makeEl,
  getElementById: () => null,     // 清理阶段取不到 → 什么都不做
  addEventListener() {}, removeEventListener() {},
}
globalThis.window = {
  // 刻意**不提供 open**:页面内打印不再开子窗口(见文件头 2026-10-20)
  addEventListener() {}, removeEventListener() {},
  print() { captured.printed++ },
}
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }
globalThis.alert = () => { throw new Error('不应触发打印失败告警') }

const { printProductCards, productCardQrText, printPuOrder, printPuOrderNoAmount, printLocationCards, locationCardQrText,
  schedPlanSheetHtml, planSheetDates, printSchedPlanSheet, pickPlanSheetRows, planSheetShop, planSheetTitle, planSheetDatesFromRows, planSheetWindow, ymdAddDays, MAX_SHEET_DAYS, planSheetPrintDates, PLAN_SHEET_DEFAULT_DAYS, PLAN_SHEET_MAX_PRINT_DAYS, pickSlipHtml, printWoQr } = await import('./print-formats.js')

test('单据行(带可选键):订单编号/供应商/数量/批次/生产日期填充进卡面', async () => {
  const before = captured.printed
  const sent = await printProductCards([{
    编码: 'Y-CSA-23', 规格: '2-3mm', 数量: 11, 批次: '20260928',
    订单编号: 'YJ-20260921-05', 供应商名称: '淄博宗立新材料科技有限公司', 生产日期: '2026-09-21',
  }])
  assert.equal(sent, true)
  assert.equal(captured.printed, before + 1, '走页面内打印(window.print 一次,不开子窗口)')
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

// ═══ 仓位标识卡(WHLOC 仓位档案「二维码标签」,2026-09-28 建为库位卡,2026-10-08 库位→仓位):同款 75×100mm,卡面只放仓位字段 ═══

test('仓位标识卡:卡面=仓库/仓位地址/仓位编码,二维码=仓库编码@仓位编码(固定两段)', async () => {
  const sent = await printLocationCards([{ 仓库: '原料仓', 仓库编码: 'CK01', 仓位地址: 'A区3排2层', 仓位编码: 'KW-0001' }])
  assert.equal(sent, true)
  const html = captured.html
  assert.ok(/class="lb">仓　　库：/.test(html), '仓库字段标签(四字对齐)')
  assert.ok(/仓　　库：<\/span><span class="v">原料仓/.test(html), '仓库值填充')
  assert.ok(/仓位地址：<\/span><span class="v">A区3排2层/.test(html), '仓位地址填充')
  assert.ok(/仓位编码：<\/span><span class="v">KW-0001/.test(html), '仓位编码填充')
  assert.ok(/data:image\/png/.test(html), '二维码应生成 data URL')
  // 卡面不含商品标识卡字段(用户口径:仓位卡只服务定位)
  for (const absent of ['订单编号', '供应商名称', '物料编码', '物料规格', '数　　量', '批　　次', '生产日期'])
    assert.ok(!html.includes(absent), `卡面不得出现商品字段:${absent}`)
  // 二维码内容:固定两段,顺序 仓库编码@仓位编码(2026-10-18 用户口径:地址含中文且会漂,不再进码)
  assert.equal(locationCardQrText({ 仓库: '原料仓', 仓库编码: 'CK01', 仓位地址: 'A区3排2层', 仓位编码: 'KW-0001' }),
    'CK01@KW-0001', '两段式(首段=仓库编码,不是仓库名称;地址不进码)')
  assert.equal(locationCardQrText({ 仓库: '原料仓', 仓位地址: 'A区3排2层', 仓位编码: 'KW-0001' }),
    '@KW-0001', '无仓库编码=空首段(仓库名称不进二维码)')
})

test('仓位二维码:空段保留占位(缺仓位编码=仓库编码@),不静默丢段', () => {
  assert.equal(locationCardQrText({ 仓库编码: 'CK02' }), 'CK02@')
})

test('仓位标识卡:空行/无编码行 直接返回 false', async () => {
  assert.equal(await printLocationCards([]), false)
  assert.equal(await printLocationCards([{ 仓库: '原料仓', 仓位地址: '无编码行' }]), false)
})

const PU_DOC = {
  单据编号: 'PO-2026-09-0001', 单据日期: '2026-09-28', 供应商编码: 'GYS001',
  供应商: '深圳市陶氏水处理设备技术开发有限公司', 付款方式: '月结30天',
}
const PU_LINES = [
  { 物料编码: 'M-001', 物料名称: '物料A', 规格型号: 'Φ20', 单价: 1.5, 单位: '支', 数量: 10, 金额: 15, 预计到货日期: '2026-10-01', '税率%': 13, 备注: '' },
  { 物料编码: 'M-002', 物料名称: '物料B', 规格型号: 'Φ25', 单价: 2, 单位: '支', 数量: 5, 金额: 10, 备注: '加急' },
]

test('打印订单无金额 = 送货单(2026-11-11 用户口径:报表名改送货单、下方不写供方/需方)', () => {
  printPuOrderNoAmount(PU_DOC, PU_LINES)
  const html = captured.html
  // ① 标题改名
  assert.ok(html.includes('<h1>送货单</h1>'), '标题=送货单(2026-11-11 改名)')
  assert.ok(!html.includes('银嘉采购订单'), '不得再出现旧标题「银嘉采购订单」')
  // ② 下方不再有供方/需方签章框
  assert.ok(!html.includes('供　方'), '送货单不印「供　方」框')
  assert.ok(!html.includes('需　方'), '送货单不印「需　方」框')
  assert.ok(!html.includes('class="sign"'), '签章框整块不出现')
  // ③ 其余与采购订单同款
  assert.ok(html.includes('付款方式') && html.includes('是否含税'), '信息区保留')
  assert.ok(html.includes('注意事项：'), '注意事项块保留')
  assert.ok(html.includes('<th>交期要求</th>'), '交期要求列保留')
  assert.ok(html.includes('加急'), '备注列')
  assert.ok(/总　计<\/td><td class="r">15<\/td><td><\/td><td><\/td>/.test(html), '总计=仅数量合计(15),无金额单元格')
})

test('打印订单无金额:仍不带金额列(单价/小计不出现)', () => {
  printPuOrderNoAmount(PU_DOC, PU_LINES)
  const html = captured.html
  assert.ok(!html.includes('<th>单价</th>'), '不得有单价列')
  assert.ok(!html.includes('<th>小计</th>'), '不得有小计列')
})

test('打印采购订单:供方单位名称带入供应商名称 + 需方联系人/联系方式按 opts.buyer 印(2026-11-11)', () => {
  printPuOrder(PU_DOC, PU_LINES, { buyer: { 联系人: '李文', 联系方式: '13800001111' } })
  const html = captured.html
  assert.ok(html.includes('<h1>银嘉采购订单</h1>'), '有金额版标题仍是银嘉采购订单')
  assert.ok(html.includes('供　方') && html.includes('需　方'), '有金额版保留供/需方签章框')
  assert.ok(html.includes(`单位名称：${PU_DOC['供应商']}`), '供方单位名称 = 本单供应商名称(不再留空)')
  assert.ok(html.includes('联 系 人：李文') && html.includes('联系方式：13800001111'),
    '需方联系人/联系方式 = 打印前弹窗选的那一组')
  assert.ok(!html.includes('孙郝聪'), '传了 buyer 就不再用公司默认那组')
})

test('打印采购订单:没传 buyer 时用公司默认那组(老纸不变)', () => {
  printPuOrder(PU_DOC, PU_LINES)
  const html = captured.html
  assert.ok(html.includes('联 系 人：孙郝聪') && html.includes('联系方式：13718162430'),
    '未传 buyer ⇒ 回落 COMPANY.buyer(历史行为)')
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

// ── 采购订单打印弹窗(2026-11-07):勾选打印 + 填写数量 + 打印记录 ──────────────────
// 用户口径「两个报表一个有金额,一个没有金额,需要能够在打印报表的时候编辑(像打印材料码的编辑一样),
// 要可以勾选打印和填写数量」+「弹窗有对已经打印的做记录吗」⇒ 选「像材料码那样」:
// 落纸行由服务端按订单行重算并落快照(PuPrintService),弹窗用**返回的落纸行**出纸(记录=纸同源);
// 小计口径的前端预览单测见 core/panel/puPrintAmount.test.js。这里只钉住两个版式都把结果原样落纸、
// 且返回 true = 已交给打印层(弹窗据此决定要不要撤销刚落的打印记录)。
const PU_EDIT_LINES = [
  { id: 11, 行号: '1', 物料编码: 'M-001', 物料名称: '物料A', 单位: '支', 数量: 10, 单价: 1.5, 金额: 15 },
  // 带折扣的行:金额(80) ≠ 单价×数量(100) —— 没改数量时必须原样落纸
  { id: 12, 行号: '2', 物料编码: 'M-002', 物料名称: '物料B', 单位: '支', 数量: 10, 单价: 10, 金额: 80 },
]

test('打印采购订单/无金额版:返回 true = 已交给页面内打印层(弹窗据此决定保留/撤销打印记录)', () => {
  const doc = { 单据编号: 'PO-EDIT-1', 供应商: '某供应商' }
  assert.equal(printPuOrder(doc, PU_EDIT_LINES), true, '有金额版返回 true')
  assert.equal(printPuOrderNoAmount(doc, PU_EDIT_LINES), true, '无金额版返回 true')
  const html = captured.html
  assert.ok(html.includes('M-001') && html.includes('M-002'), '两行都在纸面上')
})


// ── 成型车间排单计划(2026-10-31) ────────────────────────────────────────────
// 用户口径「需要能打出这样的报表形式,就在当前工单排产处实现,不需要根据产线处理」⇒
//   版式照纸表:客户等级/客户名称/产品编号/型号/成型车间/未完成总数/生产计划数量/实际完成数量/
//   成型交期/成型交期紧迫度/7天/15天/大于15/日期列(=日计划)。纯函数 schedPlanSheetHtml 可直接断言。

test('planSheetDates:从今天起取 5 天(纸表也就 3~5 天);今天以后没有就退化取最后几天', () => {
  const dates = ['2026-10-20', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03',
    '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']
  assert.deepEqual(planSheetDates(dates, '2026-10-31'), ['2026-10-31', '2026-11-01', '2026-11-02',
    '2026-11-03', '2026-11-04'], '从今天起 5 天(过去日期不印)')
  assert.deepEqual(planSheetDates(['2026-10-01', '2026-10-02'], '2026-10-31'), ['2026-10-01', '2026-10-02'],
    '全是过去日期时退化取最后几天(否则一张空表)')
  assert.deepEqual(planSheetDates([], '2026-10-31'), [])
})

// ── 2026-11-04 用户口径:「打印的就按这些勾选的表中最前面的日期到最后的一个日期就行」──────────
//    日期列 = 勾选行的日计划从最早 → 最晚(连续、含中间空列),不再锚定"今天"。纯函数直测。
test('planSheetDatesFromRows:勾选行 最前日期→最后日期,连续补空列,历史日期不再被切掉', () => {
  const rows = [
    { 日计划: { '2026-10-29': 2000, '2026-10-30': 2000, '2026-10-31': 2000 } },
    { 日计划: { '2026-10-30': 223, '2026-11-07': 222 } },
  ]
  assert.deepEqual(planSheetDatesFromRows(rows, '2026-11-04', 5),
    ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
      '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'],
    '10-29~11-07 连续 10 天(中间 11-01~11-06 没计划的也留列)')
  assert.deepEqual(planSheetDatesFromRows([{ 日计划: { '2026-11-04': 0 } }], '2026-11-04', 5),
    ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'],
    '勾选行一个非零计划都没有 ⇒ 退回今天起 5 天(不打出没有日期列的空表)')
  assert.deepEqual(planSheetDatesFromRows([{ 日计划: { '2026-11-04': 3 } }], '2026-11-04', 5),
    ['2026-11-04'], '只有一天 ⇒ 只出 1 列')
  assert.deepEqual(planSheetDatesFromRows([], '2026-11-04', 3),
    ['2026-11-04', '2026-11-05', '2026-11-06'], '没有行 ⇒ 兜底窗口')
})

test('planSheetDatesFromRows:跨度超上限时截成最近 MAX_SHEET_DAYS 天(防脏数据撑爆纸面)', () => {
  const rows = [{ 日计划: { '2026-01-01': 1, '2026-12-31': 1 } }]
  const ds = planSheetDatesFromRows(rows, '2026-11-04', 5)
  assert.equal(ds.length, MAX_SHEET_DAYS, '最多 31 列')
  assert.equal(ds[ds.length - 1], '2026-12-31', '保留最新那段(结尾 = 最后一个计划日)')
  assert.equal(ds[0], ymdAddDays('2026-12-31', -(MAX_SHEET_DAYS - 1)))
})

test('planSheetWindow/ymdAddDays:连续窗口、跨月、非法输入', () => {
  assert.deepEqual(planSheetWindow('2026-10-30', 5),
    ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'], '跨月')
  assert.deepEqual(planSheetWindow('2026-02-26', 4),
    ['2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01'], '平年跨月')
  assert.deepEqual(planSheetWindow('', 5), [], '非法起始 ⇒ 空')
  assert.equal(planSheetWindow('2026-11-04', 99).length, MAX_SHEET_DAYS, '天数夹到上限')
  assert.equal(ymdAddDays('2026-11-04', -3), '2026-11-01')
  assert.equal(ymdAddDays('bad', 1), '')
})

test('schedPlanSheetHtml:纸表列齐全 + 日期列 = 各行日计划', async () => {
  const rows = [{
    客户等级: '', 客户: '张莉', 加工单号: 'GD-2026-10-0226-1', 工单行号: 1, 公司代码: '0',
    物料编码: 'S031-3', 规格型号: '28*12*178', 生产线: '1号机',
    未交量: 10, 排产数量: 10, 当前工序完工量: 0,
    交期: '2026-11-05', 交期紧迫度: 5, '7天已排': 10, '15天已排': 10, '大于15天已排': 0,
    日计划: { '2026-10-31': 2, '2026-11-01': 2, '2026-11-05': 3 },
  }]
  // 2026-11-04 起标题/车间列头按工序产线动态 ⇒ 显式传 shop=成型,保持原纸表版式断言
  const html = await schedPlanSheetHtml(rows, ['2026-10-31', '2026-11-01', '2026-11-05'], { today: '2026-10-31', shop: '成型' })
  // 2026-11-05 版式重排:长表头用**显式换行**(断点固定,不再出现「生产计划数/量」掉单字);
  //   表头 HTML 里就是 <br>,这里按最终表头逐字断言。
  for (const h of ['客户名称', '产品编号', '型号', '成型车间', '未完成<br>总数',
    '生产计划<br>数量', '实际完成<br>数量', '成型交期', '成型交期<br>紧迫度', '7天', '15天', '大于15']) {
    assert.ok(html.includes('>' + h + '</th>'), '表头应含 ' + h)
  }
  // 2026-11-04 用户口径「客户等级这个列下不存在数据就默认隐藏了」:该行客户等级为空 ⇒ 不印这一列
  assert.ok(!html.includes('>客户等级</th>'), '客户等级全空 ⇒ 默认隐藏该列')
  // 有值时才印(甲/乙/丙…)——用同一行补一个非空等级再生成一次
  const rowsWithGrade = [{ ...rows[0], 客户等级: '甲' }]
  const html2 = await schedPlanSheetHtml(rowsWithGrade, ['2026-10-31'], { today: '2026-10-31', shop: '成型' })
  assert.ok(html2.includes('>客户等级</th>'), '有值 ⇒ 客户等级列照印')
  assert.ok(/>甲</.test(html2), '等级值要印出来')
  assert.ok(html.includes('10月31日') && html.includes('11月5日'), '日期列头用 月日 写法')
  assert.ok(html.includes('张莉') && html.includes('S031-3') && html.includes('28*12*178') && html.includes('1号机'))
  assert.ok(/>10</.test(html), '未完成总数/排产数量应出现')
  assert.ok(html.includes('@page{size:A4 landscape'), '横向 A4')
  assert.ok(html.includes('成型车间排单计划'), '标题')
  // 2026-11-01 用户口径「不是两张纸,当前同一行融合起来」:单据编号 + 二维码都在同一行里
  assert.ok(html.includes('>单据编号</th>'), '同一行带单据编号列')
  assert.ok(html.includes('GD-2026-10-0226-1'), '单据编号值在行里')
  assert.ok(html.includes('>二维码</th>') && /data:image\/png/.test(html), '同一行带二维码')
  assert.ok(!html.includes('成型生产任务单'), '不再另起一张任务单')
})

// 2026-11-05 客户口径:「打印的就是打印的时候显示 3 天或者是 3 天 4 天,这样子我们自己可以去设置」
//   ⇒ 日期列 = 勾选行最早日期起,连续只印 N 天(默认 3,可设 1~10),不再印"最前→最后"的长表。
test('planSheetPrintDates:默认只印 3 天(从勾选行最早日期起),天数可设 1~10', () => {
  const rows = [{ 日计划: { '2026-10-29': 2000, '2026-10-30': 2000, '2026-11-07': 222 } }]
  assert.equal(PLAN_SHEET_DEFAULT_DAYS, 3, '默认 3 天')
  assert.deepEqual(planSheetPrintDates(rows, '2026-11-05'),
    ['2026-10-29', '2026-10-30', '2026-10-31'], '默认 3 天,从最早日期起')
  assert.deepEqual(planSheetPrintDates(rows, '2026-11-05', 4),
    ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'], '可设 4 天(第 4 天没计划也留空列)')
  assert.deepEqual(planSheetPrintDates(rows, '2026-11-05', 1), ['2026-10-29'], '最少 1 天')
  assert.equal(planSheetPrintDates(rows, '2026-11-05', 99).length, 10, '最多 10 天')
  assert.equal(planSheetPrintDates(rows, '2026-11-05', 'bad').length, 3, '非法天数 ⇒ 回默认 3 天')
  assert.deepEqual(planSheetPrintDates([], '2026-11-05'),
    ['2026-11-05', '2026-11-06', '2026-11-07'], '勾选行没有计划 ⇒ 今天起 3 天')
})

// 2026-11-04 用户口径「当前在不同的工序产线显示的这个工序名称也要不同」
//   ⇒ 纸表标题与「车间」列头(含交期两列)跟着工序产线变,不再一律「成型」。
test('排单计划:标题/车间列头按工序产线动态(成型/切炭/组装…),混打多工序退回通用', async () => {
  assert.equal(planSheetShop([{ 当前工序: '切炭' }, { 当前工序: '切炭' }]), '切炭', '行内唯一工序 ⇒ 切炭')
  assert.equal(planSheetShop([{ 当前工序: '成型' }, { 当前工序: '切炭' }]), '', '混打多工序 ⇒ 空(不冒充某个车间)')
  assert.equal(planSheetShop([{ 当前工序: '切炭' }], { shop: '组装' }), '组装', 'opts.shop 优先')
  assert.equal(planSheetShop([{ 生产线: '切炭(自动)', 生产车间: '切炭' }]), '切炭', '行内 生产车间 优先于工序')
  assert.equal(planSheetTitle('切炭'), '切炭车间排单计划')
  assert.equal(planSheetTitle('切炭车间'), '切炭车间排单计划', '车间名自带「车间」后缀时不得叠成「车间车间」')
  assert.equal(planSheetTitle(''), '排单计划', '车间未知 ⇒ 通用标题(不写死成型)')

  const row = (op, line) => ({
    客户: 'A', 加工单号: 'GD-' + op, 工单行号: 1, 公司代码: '0', 物料编码: 'S031-3',
    规格型号: '28*12', 生产线: line, 当前工序: op, 交期: '2026-11-05', 交期紧迫度: 3,
    未交量: 10, 排产数量: 10, 当前工序完工量: 0, 日计划: { '2026-10-31': 1 },
  })
  const cut = await schedPlanSheetHtml([row('切炭', '切炭(自动)')], ['2026-10-31'], { today: '2026-10-31' })
  assert.ok(cut.includes('切炭车间排单计划'), '切炭线标题应为 切炭车间排单计划')
  assert.ok(!cut.includes('成型车间排单计划'), '切炭纸不再出现「成型车间排单计划」')
  for (const h of ['切炭车间', '切炭交期', '切炭交期<br>紧迫度']) {
    assert.ok(cut.includes('>' + h + '</th>'), '切炭纸列头应含 ' + h)
  }
  assert.ok(!cut.includes('>成型交期</th>'), '切炭纸不应出现「成型交期」')
  assert.ok(cut.includes('切炭(自动)'), '车间列的值(产线)照常印')

  const asm = await schedPlanSheetHtml([row('组装', '组装(自动)')], ['2026-10-31'], { today: '2026-10-31' })
  assert.ok(asm.includes('组装车间排单计划') && asm.includes('>组装车间</th>'), '组装线同理')

  const mixed = await schedPlanSheetHtml([row('成型', '1号机'), row('切炭', '切炭(自动)')], ['2026-10-31'], { today: '2026-10-31' })
  assert.ok(mixed.includes('>排单计划</span>'), '混打多工序 ⇒ 通用标题「排单计划」')
  for (const h of ['生产车间', '交期', '交期<br>紧迫度']) {
    assert.ok(mixed.includes('>' + h + '</th>'), '混打 ⇒ 通用列头 ' + h)
  }

  // 真正出纸入口:浏览器标题(打印页眉/另存 PDF 的默认文件名)也随工序变
  const beforeTitle = documentTitleLog.length
  await printSchedPlanSheet([row('切炭', '切炭(自动)')], ['2026-10-31'], { today: '2026-10-31', dates: ['2026-10-31'] })
  assert.ok(documentTitleLog.slice(beforeTitle).includes('切炭车间排单计划'),
    '打印标题随工序:切炭车间排单计划(实际记录 ' + JSON.stringify(documentTitleLog.slice(beforeTitle)) + ')')
})

test('schedPlanSheetHtml:opts.dates = 勾选行 最前→最后(历史窗口照印);列多时表头改紧凑写法', async () => {
  const rows = [{
    客户: '张莉', 加工单号: 'GD-2026-10-0227', 工单行号: 1, 公司代码: '0', 物料编码: 'B-58-07',
    规格型号: '48*30*264.5', 生产线: '2号车间', 未交量: 6000, 排产数量: 6000, 当前工序完工量: 0,
    交期: '2026-10-31', 交期紧迫度: -4, '7天已排': 6000, '15天已排': 6000, '大于15天已排': 0,
    日计划: { '2026-10-29': 2000, '2026-10-30': 2000, '2026-10-31': 2000 },
  }]
  const dates = planSheetDatesFromRows(rows, '2026-11-04', 5)
  assert.deepEqual(dates, ['2026-10-29', '2026-10-30', '2026-10-31'], '历史 3 天')
  const html = await schedPlanSheetHtml(rows, [], { dates })
  for (const h of ['10月29日', '10月30日', '10月31日']) assert.ok(html.includes('>' + h + '</th>'), '历史日期列表头: ' + h)
  assert.ok(html.includes('>2000</td>'), '历史计划的量要印出来(不再被"今天"切掉)')
  // 10 列(>7)⇒ 紧凑表头 M/D + tooltip 带完整日期
  const wide = planSheetDatesFromRows([{ 日计划: { '2026-10-29': 1, '2026-11-07': 1 } }], '2026-11-04', 5)
  assert.equal(wide.length, 10)
  const h2 = await schedPlanSheetHtml([{ 客户: 'A', 加工单号: 'GD-2', 工单行号: 1, 公司代码: '0', 日计划: { '2026-10-29': 1 } }], [], { dates: wide })
  assert.ok(h2.includes('>10/29</th>'), '列多时表头用 M/D 紧凑写法')
  assert.ok(h2.includes('title="2026-10-29"'), '紧凑表头保留完整日期 tooltip')
})

// 2026-11-04 用户口径「这个当前二维码太小了」:二维码按物理尺寸出纸(52px≈13.8mm),不再跟着列数缩;
//   行数多时才适度收一点(48/44/38),保证一张 A4 装得下。
// 2026-11-05 版式重排:二维码列宽固定 5.5%,行高 = 二维码 + 8px 留白(最少 42px)。
test('schedPlanSheetHtml:二维码尺寸(行少 52px 不缩 / 行多 48→38px) + 底图 300px 打印清晰', async () => {
  const mk = (no) => ({ 客户: 'A', 加工单号: 'GD-' + no, 工单行号: 1, 公司代码: '0', 日计划: { '2026-10-29': 1 } })
  const h1 = await schedPlanSheetHtml([mk(1)], [], { dates: ['2026-10-29'] })
  assert.ok(h1.includes('td.qr img{width:52px;height:52px}'), '行少(≤5)⇒ 52px(≈13.8mm)')
  assert.ok(h1.includes('tbody tr{height:60px}'), '行高跟着二维码(52+8)')
  assert.ok(h1.includes('<col style="width:5.5%"/>'), '二维码列固定 5.5%')
  // 底图分辨率:PNG IHDR 的 width(偏移 16)应为 300 —— 打印才能清晰(以前 108px 放大发虚)
  const url = (h1.match(/src="(data:image\/png;base64,[^"]+)"/) || [])[1]
  assert.ok(url, '应带二维码图片')
  const png = Buffer.from(url.split(',')[1], 'base64')
  assert.equal(png.readUInt32BE(16), 300, '二维码底图 300px(打印等效 500+dpi)')

  const wide = planSheetDatesFromRows([{ 日计划: { '2026-10-29': 1, '2026-11-07': 1 } }], '2026-11-04', 5)
  const h2 = await schedPlanSheetHtml([mk(2)], [], { dates: wide })
  assert.ok(h2.includes('td.qr img{width:52px;height:52px}'), '10 列但只有 1 行 ⇒ 仍 52px')

  const mid = await schedPlanSheetHtml(Array.from({ length: 8 }, (_, i) => mk(i)), [], { dates: wide })
  assert.ok(mid.includes('td.qr img{width:48px;height:48px}'), '8 行 ⇒ 收到 48px')
  assert.ok(mid.includes('tbody tr{height:56px}'), '8 行 ⇒ 行高 56px')

  const many = Array.from({ length: 16 }, (_, i) => mk(i))
  const h3 = await schedPlanSheetHtml(many, [], { dates: wide })
  assert.ok(h3.includes('td.qr img{width:38px;height:38px}'), '16 行 ⇒ 收到 38px 保证一页')
  assert.ok(h3.includes('tbody tr{height:46px}'), '行高 46px(38+8)')
})

// 2026-11-05 版式重排(用户口径「不需要实现那么多天数,调整优化一下表格和设计,不需要那么窄」):
//   ① 日期列**先**按每天 6% 给(3 天 18%),剩余宽度全给固定列 —— 天数越少固定列越宽;
//   ② 长表头显式换行,断点固定;日期表头始终横排 nowrap;
//   ③ 正文字号 10.5px / 表头 9.5px(旧版为了 16~31 天压到 9.5/9px),A4 横向页边距 8mm/6mm。
test('schedPlanSheetHtml:2026-11-05 版式 — 日期先占 6%/天,固定列拿剩余宽度,字号加大', async () => {
  const mk = (no) => ({ 客户: 'A', 加工单号: 'GD-' + no, 工单行号: 1, 公司代码: '0', 日计划: { '2026-10-29': 1 } })
  const rows = [mk(1), mk(2), mk(3)]
  const h3d = await schedPlanSheetHtml(rows, [], { dates: ['2026-10-29', '2026-10-30', '2026-10-31'] })
  assert.ok(h3d.includes('<col style="width:6.00%"/>'), '3 天 ⇒ 每天 6%(≈65px,4 位数字 + 横排表头都放得下)')
  // 固定列按剩余宽度分:客户名称/单据编号拿 10.49%(旧的压窄算法只有 9%/10%)
  assert.ok(h3d.includes('<col style="width:10.49%"/>'), '客户名称/单据编号 各 10.49%')
  assert.ok(h3d.includes('padding:3px 3px;font-size:10.5px'), '正文 10.5px(≈7.9pt)、内边距 3px')
  assert.ok(h3d.includes('font-weight:600;text-align:center;font-size:9.5px'), '表头 9.5px')
  assert.ok(h3d.includes('@page{size:A4 landscape;margin:8mm 6mm}'), 'A4 横向,上下 8mm / 左右 6mm')
  assert.ok(h3d.includes('table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #222}'),
    '表外框加粗一档(出纸不显得单薄)')
  // 1 天 ⇒ 固定列拿到更多宽度(日期少,固定列更宽,这就是"不再那么窄"的来源)
  const h1d = await schedPlanSheetHtml(rows, [], { dates: ['2026-10-29'] })
  const w1 = [...h1d.matchAll(/<col style="width:([\d.]+)%"\/>/g)].map((m) => Number(m[1]))
  const w3 = [...h3d.matchAll(/<col style="width:([\d.]+)%"\/>/g)].map((m) => Number(m[1]))
  assert.ok(w1[0] > w3[0], '1 天时客户名称列比 3 天时更宽')
  assert.equal(w1.length, w3.length - 2, '固定列数不变(只差 2 个日期列)')
  // 各列百分比加起来就是 100%(浏览器按 colgroup 铺满纸宽)
  for (const ws of [w1, w3]) {
    assert.ok(Math.abs(ws.reduce((a, b) => a + b, 0) - 100) < 0.5, '列宽合计 ≈100%')
  }
})

// 2026-11-04 用户口径「日期不要竖排」:日期表头**始终横排 nowrap**(绝不折成竖条);
//   2026-11-05 起打印天数最多 10 列,超出的入参只印前 10 列(防脏数据把版式压回挤窄形态)。
test('schedPlanSheetHtml:日期表头始终横排;超过 10 列只印前 10 列', async () => {
  const mk = (no) => ({ 客户: 'A', 加工单号: 'GD-' + no, 工单行号: 1, 公司代码: '0', 日计划: { '2026-10-29': 1 } })
  const rows = [mk(1), mk(2), mk(3)]
  assert.equal(PLAN_SHEET_MAX_PRINT_DAYS, 10, '一张纸最多 10 个日期列')
  const d10 = planSheetWindow('2026-10-29', 10)
  const h = await schedPlanSheetHtml(rows, [], { dates: d10 })
  assert.ok(!h.includes('writing-mode'), '日期表头不再竖排')
  assert.equal((h.match(/<th class="dt"/g) || []).length, 10, '10 个日期表头(横排)')
  assert.ok(h.includes('th.dt{white-space:nowrap'), '日期表头禁止折行(不会变竖条)')
  assert.ok(h.includes('>10/29</th>'), '列多时日期按「10/29」紧凑横排写法')
  assert.ok(h.includes('title="2026-10-29"'), 'date 表头保留完整日期 tooltip')
  assert.ok(h.includes('font-size:8px'), '8 天以上表头降一档字号(9px/8px),但不再压到 6px')

  const d31 = planSheetWindow('2026-10-01', 31)
  const h31 = await schedPlanSheetHtml(rows, [], { dates: d31 })
  assert.equal((h31.match(/<th class="dt"/g) || []).length, 10, '31 天入参也只印前 10 列')
  // 每行日期格 10 个 + 数字列 7 个(未完成总数/生产计划/实际完成/紧迫度/7天/15天/大于15)都带 class="r"
  assert.equal((h31.match(/<td class="r">/g) || []).length, 3 * (10 + 7), '每行 10 个日期格 + 7 个数字列')
  assert.ok(!h31.includes('td.d{font-size:7px'), '不再需要「极窄格降字号」那套补丁')
})

test('pickPlanSheetRows:只留勾选行、保持页面顺序;没勾选=空(不悄悄退回整线全打)', () => {
  const rows = [
    { 行id: 11, 加工单号: 'GD-A' }, { 行id: 12, 加工单号: 'GD-B' }, { 行id: 13, 加工单号: 'GD-C' },
  ]
  assert.deepEqual(pickPlanSheetRows(rows, [13, 11]).map((r) => r.加工单号), ['GD-A', 'GD-C'],
    '只留勾选的 2 行,顺序仍按页面(不是按勾选先后)')
  assert.deepEqual(pickPlanSheetRows(rows, []), [], '没勾选 ⇒ 空数组(由调用方提示先勾选)')
  assert.deepEqual(pickPlanSheetRows(rows, ['12']).map((r) => r.加工单号), ['GD-B'], '字符串 id 也认')
  assert.deepEqual(pickPlanSheetRows(rows, [null, '']), [], '空 id 不算勾选')
  assert.deepEqual(pickPlanSheetRows([], [11]), [], '接口没行 ⇒ 空')
  assert.deepEqual(pickPlanSheetRows(rows, [99]), [], '勾选行已不在返回里 ⇒ 空(不打出别人)')
})

test('printSchedPlanSheet:空数据不出纸;有数据出**一张**(计划+单据编号+二维码同一行)', async () => {
  const before = captured.printed
  assert.equal(await printSchedPlanSheet([], []), false, '空数据返回 false,不打印')
  assert.equal(captured.printed, before, '空数据不应触发 window.print')
  const ok = await printSchedPlanSheet([{
    客户: 'A', 生产线: '1号机', 加工单号: 'GD-1', 工单行号: 1, 公司代码: '0',
    物料编码: 'S031-3', 产品名称: '滤芯', 规格型号: '28*12', 需求数量: 10, 排产数量: 10,
    计划完工日期: '2026-11-05', 日计划: { '2026-10-31': 1 },
  }], ['2026-10-31'], { today: '2026-10-31', shop: '成型' })
  assert.equal(ok, true)
  assert.equal(captured.printed, before + 1, '走页面内打印(window.print 一次)')
  assert.ok(captured.html.includes('成型车间排单计划'), '标题:排单计划')
  assert.ok(!captured.html.includes('成型生产任务单'), '不再另起一张任务单')
  assert.ok(/data:image\/png/.test(captured.html), '同一行行尾二维码')
  assert.ok(captured.html.includes('GD-1') && captured.html.includes('S031-3'), '同一行主要信息(单据编号/商品编码)')
})

// ══════════════════════════════════════════════════════════════════
// 纸面「生产领料单」(浏览器打印层;2026-11-05 抽出 pickSlipHtml 便于单测)
// 用户口径:「明细只有 3 行,却给了多行的数据,并且二维码过大」「大于 9 行还能打印吗」
// ══════════════════════════════════════════════════════════════════
const slipRows = (n) => Array.from({ length: n }, (_, i) => ({
  材料名称: '材料' + (i + 1), 规格: '100*200', 单位: '张', 请领数量: (i + 1) * 2, 实发数量: i + 1, 备注: '',
}))
const slipPayload = (n) => ({
  标题: '生产领料单', 工单号: 'GD-T-1', 工单行号: 1, 领料单号: 'LL-T-1', 领料部门: '成型1线',
  打印日期: '2026-11-05', 明细: slipRows(n),
})

test('pickSlipHtml:空行不印订单号(3 行明细就只出现 3 次单号)+ 二维码 24mm 不压表格', () => {
  const html = pickSlipHtml(slipPayload(3), 'data:image/png;base64,AA')
  assert.equal((html.match(/GD-T-1#1/g) || []).length, 3, '3 行数据 → 单号只印 3 次(空行不重复)')
  assert.ok(html.includes('<td></td><td></td><td></td><td></td>'), '空行整行留白')
  assert.ok(html.includes('材料3') && !html.includes('材料4'), '只有 3 行数据')
  assert.ok(html.includes('width:24mm'), '二维码缩到 24mm')
  assert.ok(!html.includes('left:6mm;top:5mm'), '二维码不再绝对定位压在表格上')
  assert.ok(html.includes('@page{size:210mm 148.5mm'), '中一刀 210×148.5 横打')
  assert.ok(!html.includes('第 1/1 页'), '单页不印页码')
})

test('pickSlipHtml:超过 10 行自动换页,一行都不丢(13 行 → 2 页)', () => {
  const html = pickSlipHtml(slipPayload(13), '')
  assert.equal((html.match(/<div class="card">/g) || []).length, 2, '13 行 → 2 张纸')
  assert.ok(html.includes('第 1/2 页') && html.includes('第 2/2 页'), '每页标页码')
  for (let i = 1; i <= 13; i++) assert.ok(html.includes('材料' + i), '第 ' + i + ' 行必须在纸上(旧版 13 行会被截掉)')
  assert.equal((html.match(/GD-T-1#1/g) || []).length, 13, '13 行数据 → 单号 13 次')
})

test('printWoQr:带明细的载荷走同一套版式(打印层收到的是新 HTML)', async () => {
  const before = captured.printed
  const ok = await printWoQr(slipPayload(3))
  assert.equal(ok, true)
  assert.equal(captured.printed, before + 1, '走页面内打印(window.print 一次)')
  assert.ok(captured.html.includes('width:24mm'), '新二维码尺寸')
  assert.equal((captured.html.match(/GD-T-1#1/g) || []).length, 3, '空行不印单号')
})
