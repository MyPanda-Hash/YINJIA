/**
 * wo-qr.test.js — 工单二维码内容规则单测(2026-10-09 规则改版)
 * 规则:公司代码@工单号@(1000+工单行号),行号 3 位不足补 0;例 0@GD2608100001@1003。
 * 旧规则(工单号|批号|产品编码|排产数量|生产线)作废;扫码报工/领料按新口径解析。
 * 运行:npm test(node --test);打印冒烟走 qrcode 库真实出图,mock DOM 捕获打印层 HTML。
 * ⚠ 2026-10-19:「打印工单」从**弹窗打印**改成**页面内打印层**(不再 window.open),
 *   所以这里改成 mock document/body 并抓取 `#yj-print-host` 的 innerHTML。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const captured = { html: '', printed: 0 }
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '',
    children: [], style: {},
    appendChild(child) {
      this.children.push(child)
      if (child && child.id === 'yj-print-host') captured.html = child.innerHTML
      return child
    },
    remove() { /* noop */ },
    setAttribute() { /* noop */ },
  }
}
const head = makeEl('head')
const body = makeEl('body')
globalThis.document = {
  title: '',
  head, body,
  createElement: makeEl,
  getElementById: () => null,     // 清理阶段取不到 → 什么都不做
  addEventListener() {}, removeEventListener() {},
}
globalThis.window = {
  addEventListener() {}, removeEventListener() {},
  print() { captured.printed++ },
}
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }
globalThis.alert = () => { throw new Error('不应触发打印失败告警') }

const { woQrText, printWorkTaskSheet, printProductionTask } = await import('./print-formats.js')

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
  assert.equal(captured.printed, 1, '应调用一次 window.print()(页面内打印,不再弹窗)')
  assert.match(captured.html, /data:image\/png/, '行尾二维码应生成 data URL')
  assert.ok(captured.html.includes('GD2608100001'), '工单号应出现在单面')
})

// ═══ 纸面页头只有标题(2026-10-21 用户口径:不印打印日期 → 把制单人也去了 → 线体也删掉)═══
// 两条生产任务单打印通道(生产工单列表/工单排产看板 走 printWorkTaskSheet;
// 生产工单面板「打印工单」走 printProductionTask)页头上原来有「线体: xxx … 制单: 用户名 yyyy/M/d HH:mm:ss」,
// 现整行去掉,只剩居中标题。守门断言:纸面不得出现 线体/制单/打印日期/打印时间,也不得出现日期时间戳。
const PRINT_DATETIME = new RegExp('[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}[ ]+[0-9]{1,2}:[0-9]{2}')
const PRINT_ABSENT = ['线体', '制单', '打印日期', '打印时间']

test('纸面页头只有标题:printWorkTaskSheet(线体/制单/日期都不印)', async () => {
  const ok = await printWorkTaskSheet('组装生产任务单', [{
    单据编号: 'GD2608100002', 公司代码: '0', 工单行号: 1,
    是否重点管控产品: '否', 商品编码: 'P002', 商品名称: '滤芯', 规格型号: '2-3mm',
    订单数量: 50, 计划完工日期: '2026-10-09',
  }], { line: '1线', preparedBy: '张三' }) // 旧调用方若还传 line/preparedBy,也不得印到纸上
  assert.equal(ok, true)
  const html = captured.html
  const i0 = html.indexOf('<div class="hd">')
  const hd = html.slice(i0, html.indexOf('</div>', i0) + 6)
  assert.ok(hd.includes('组装生产任务单'), '页头保留标题')
  assert.ok(!hd.includes('张三') && !hd.includes('1线'), '传了 line/preparedBy 也不印')
  assert.ok(!PRINT_DATETIME.test(html), '纸面不得出现打印日期时间戳(yyyy/M/d HH:mm:ss)')
  for (const absent of PRINT_ABSENT) assert.ok(!html.includes(absent), '纸面不得出现「' + absent + '」')
})

test('纸面页头只有标题:printProductionTask', async () => {
  const ok = await printProductionTask([{
    加工单号: 'GD2608100003', 公司代码: '0', 工单行号: 2,
    客户: '客户A', 产品名称: '滤芯', 批号: 'L001', 规格型号: '2-3mm',
    排产数量: 20, 每箱数量: 10, 箱数: 2, 计划完工日期: '2026-10-09', 生产线: '1线',
  }], { line: '1线', preparedBy: '李四' })
  assert.equal(ok, true)
  const html = captured.html
  const i0 = html.indexOf('<div class="hd">')
  const hd = html.slice(i0, html.indexOf('</div>', i0) + 6)
  assert.ok(hd.includes('生产任务单'), '页头保留标题')
  assert.ok(!hd.includes('李四') && !hd.includes('1线'), '传了 line/preparedBy 也不印')
  assert.ok(!PRINT_DATETIME.test(html), '纸面不得出现打印日期时间戳(yyyy/M/d HH:mm:ss)')
  for (const absent of PRINT_ABSENT) assert.ok(!html.includes(absent), '纸面不得出现「' + absent + '」')
})

// ═══ 切炭生产任务单(2026-10-21 用户口径「增加一种打印为切炭打印」):与组装同列结构,只差标题 ═══
test('切炭生产任务单:标题对、列结构与组装一致(无成型折算列)', async () => {
  const ok = await printWorkTaskSheet('切炭生产任务单', [{
    单据编号: 'GD2608100004', 公司代码: '0', 工单行号: 5,
    是否重点管控产品: '否', 商品编码: 'P003', 商品名称: '炭棒', 规格型号: '48*30*264.5',
    订单数量: 6000, 计划完工日期: '2026-10-20',
  }])
  assert.equal(ok, true)
  const html = captured.html
  const i0 = html.indexOf('<div class="hd">')
  const hd = html.slice(i0, html.indexOf('</div>', i0) + 6)
  assert.ok(hd.includes('切炭生产任务单'), '页头标题=切炭生产任务单')
  for (const th of ['单据编号', '是否重点管控产品', '商品编码', '商品名称', '规格型号', '订单数量', '计划完工日期', '二维码'])
    assert.ok(html.includes('<th>' + th + '</th>'), '切炭单应有列:' + th)
  assert.ok(!html.includes('成型折算后数量'), '切炭单不带成型折算列')
  assert.ok(html.includes('6000'), '订单数量进纸面')
})

// ═══ 多语言:新增打印模板的菜单文案必须有英文译名(AGENTS.md 多语言强制规范) ═══
test('切炭生产任务单 en 译名存在(成型/组装译名也仍在)', async () => {
  const { readFileSync } = await import('node:fs')
  const en = readFileSync(new URL('../i18n/locales/en.js', import.meta.url), 'utf8')
  assert.match(en, /'切炭生产任务单':\s*'[^']+'/, '切炭生产任务单 needs an en translation')
  assert.match(en, /'成型生产任务单':\s*'[^']+'/, '成型生产任务单 en 译名仍在')
  assert.match(en, /'组装生产任务单':\s*'[^']+'/, '组装生产任务单 en 译名仍在')
})
