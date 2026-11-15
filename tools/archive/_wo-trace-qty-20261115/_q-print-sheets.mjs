/**
 * _q-print-sheets.mjs — 用**真实打印代码**(frontend/src/business/print-formats.js)生成
 * ①成型车间排单计划 ②成型生产任务单 的 HTML,供 ego 渲染成 PDF/PNG 取证(2026-11-15 第二轮)。
 *
 * 数据来自现役 8090(正式库只读):
 *   · 排单计划行 = POST /api/px/scheduleBoard/planSheet { scope:'未完工', 生产线:'4号车间' }
 *   · 任务单行   = POST /api/px/scheduleBoard/scheduled + /api/px/processTask/detail(算成型折算后数量)
 *
 * 运行:`node tools/archive/_wo-trace-qty-20261115/_q-print-sheets.mjs`
 */
import { writeFileSync } from 'node:fs'

// ── mock 打印层(与单测同款):抓 #yj-print-host 的 innerHTML,不真开浏览器 ──
const captured = { html: '' }
function makeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), id: '', innerHTML: '', textContent: '', style: {},
    children: [],
    appendChild(child) {
      this.children.push(child)
      if (child && child.id === 'yj-print-host') captured.html = child.innerHTML
      return child
    },
    remove() { /* noop */ }, setAttribute() { /* noop */ }, removeAttribute() { /* noop */ },
  }
}
const head = makeEl('head'); const body = makeEl('body')
let docTitle = ''
globalThis.document = {
  get title() { return docTitle }, set title(v) { docTitle = v },
  head, body, createElement: makeEl, getElementById: () => null,
  addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
}
globalThis.window = { addEventListener() {}, removeEventListener() {}, print() { /* noop */ }, getComputedStyle: () => ({}) }
globalThis.requestAnimationFrame = (cb) => { cb(); return 1 }
globalThis.alert = () => { }

const { schedPlanSheetHtml, printWorkTaskSheet, moldPlanQty } = await import('../../../frontend/src/business/print-formats.js')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const OUT = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'

const post = async (p, b, t) => (await fetch(BASE + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
  body: JSON.stringify(b),
})).json()

const lg = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ' })
const token = lg.data.token

// ── ① 排单计划 ────────────────────────────────────────────────────────────────
const ps = (await post('/api/px/scheduleBoard/planSheet', { scope: '未完工', 生产线: '4号车间' }, token)).data || {}
const psRows = ps['行'] || []
const psDates = (ps['日期'] || []).slice(0, 5)
console.log('排单计划行数=' + psRows.length + ' 日期=' + JSON.stringify(psDates))
if (psRows[0]) {
  console.log('  行数据: 排产=' + psRows[0]['排产数量'] + ' 工序计划量=' + psRows[0]['工序计划量']
    + ' 需求=' + psRows[0]['需求数量'] + ' 未交量=' + psRows[0]['未交量'])
}
const planHtml = await schedPlanSheetHtml(psRows, psDates, { today: ps['今天'] || '', shop: '成型', days: psDates.length })
writeFileSync(`${OUT}/sheet-plan.html`, planHtml, 'utf8')
console.log('排单计划 HTML 已写:' + OUT + '/sheet-plan.html')

// ── ② 成型生产任务单(成型折算后数量 = moldPlanQty)──────────────────────────────
const sched = (await post('/api/px/scheduleBoard/scheduled', { 生产线: '4号车间', scope: '未完工' }, token)).data || []
const taskRows = []
for (const r of sched) {
  let detail = null
  try {
    detail = (await post('/api/px/processTask/detail', { 工单号: r['加工单号'], 工单行id: r['行id'] }, token)).data || {}
  } catch { detail = null }
  const qty = moldPlanQty(r, detail)
  console.log('  任务单: ' + r['加工单号'] + ' 排产=' + r['排产数量'] + ' 当前工序=' + r['当前工序']
    + ' 当前工序计划量=' + r['当前工序计划量'] + ' ⇒ 成型折算后数量=' + qty)
  taskRows.push({
    单据编号: r['加工单号'], 公司代码: r['公司代码'] || '', 工单行号: r['工单行号'],
    是否重点管控产品: r['重点管控'] || '', 商品编码: r['物料编码'] || '', 商品名称: r['产品名称'] || '',
    规格型号: r['规格型号'] || '', 订单数量: r['需求数量'], 成型折算后数量: qty,
    计划完工日期: r['计划完工日期'] || '', 批号: r['批号'] || '', 排产数量: r['排产数量'],
    生产线: r['生产线'] || '4号车间', 工序: r['当前工序'] || '',
  })
}
const ok = await printWorkTaskSheet('成型生产任务单', taskRows)
console.log('printWorkTaskSheet=' + ok + ' 捕获 HTML 长度=' + captured.html.length)
writeFileSync(`${OUT}/sheet-task.html`, `<!doctype html><meta charset="utf-8"><body style="margin:0">${captured.html}</body>`, 'utf8')
console.log('任务单 HTML 已写:' + OUT + '/sheet-task.html')
