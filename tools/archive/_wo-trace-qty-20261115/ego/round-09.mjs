/**
 * round-09.mjs — 工单排产看板「需交付/已排/未交量」的可读证据图(2026-11-15)。
 *
 * 背景:本机 ego 的 `Page.captureScreenshot` 出不了帧(README §4.3 / G14),
 *   而整页 `printToPDF` 会被看板的固定高度 flex 布局裁掉(表格只剩 3 列)。
 *   做法:断言跑完后,把**真实 DOM 里的明细表**摘出来单独成页(样式表还在 head 里,元素不变),
 *   再 printToPDF → PyMuPDF 转 PNG。这是"真实渲染的表格",不是另拼的假图。
 *
 * 断言(4号车间 · GD-2026-11-0028,成型换算率 0.5):
 *   7天需交付 = 25(工序计划量;修复前 = 需求数量 50)、7天已排 = 25、未交量 = 50(排产−入库,成品口径)
 */
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const APP = 'http://127.0.0.1:8091'
import { writeFileSync } from 'node:fs'

const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')

await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(3500)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select'); if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(600)
  await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const t = items.find((it) => (it.textContent || '').replace(/\s+/g, '').includes('YINJIA-MES') && !(it.textContent || '').includes('测试')); if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await page.waitForTimeout(400)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6000)
}

// 必须 reload(hash 导航不会重载 SPA,会跑旧 chunk)
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.reload()
await page.waitForTimeout(9000)
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('.wb-left *')].find((el) => (el.textContent || '').replace(/\s+/g, '') === '4号车间')
  if (hit) hit.setAttribute('data-e2e', 'line-hit')
})
try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click: ' + e.message) }
await page.waitForTimeout(7000)

// 把明细表摘出来单独成页(保留 head 里的样式表,元素原样)
const extracted = await page.evaluate(() => {
  const tb = [...document.querySelectorAll('.el-table')].find((t) => (t.textContent || '').includes('需交付'))
  if (!tb) return { ok: false }
  document.body.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.id = 'e2e-wrap'
  wrap.style.cssText = 'margin:0;padding:10px;background:#fff;font-family:"Microsoft YaHei",sans-serif'
  const title = document.createElement('div')
  title.textContent = '工单排产 · 生产线 4号车间 · 未完工页签 —— 需交付(工序口径)/ 已排 / 未交量(成品口径)'
  title.style.cssText = 'font-size:16px;font-weight:700;margin:0 0 8px 4px;color:#1e6fb8'
  wrap.appendChild(title)
  wrap.appendChild(tb)
  document.body.appendChild(wrap)
  document.body.style.cssText = 'margin:0;background:#fff'
  const st = document.createElement('style')
  st.textContent = `
    .el-table{height:auto!important;max-height:none!important;width:max-content!important}
    .el-table__inner-wrapper{height:auto!important}
    .el-table .el-table__body-wrapper,.el-table .el-scrollbar__wrap{overflow:visible!important;height:auto!important;max-height:none!important}
    .el-table .el-scrollbar__bar{display:none!important}
    .el-table table{width:max-content!important;table-layout:auto!important}
    .el-table th,.el-table td{white-space:nowrap!important}`
  document.head.appendChild(st)
  return { ok: true, cols: tb.querySelectorAll('thead th').length }
})
console.log('extracted = ' + JSON.stringify(extracted))
await page.waitForTimeout(800)

const pdf = await page.cdp('Page.printToPDF', {
  printBackground: true, paperWidth: 42, paperHeight: 10,
  marginTop: 0.15, marginBottom: 0.15, marginLeft: 0.15, marginRight: 0.15,
})
const b64 = pdf?.data || pdf?.result?.data
if (b64) { writeFileSync(`${EV}/board-table-8091.pdf`, Buffer.from(b64, 'base64')); console.log('PDF OK board-table-8091.pdf') }
else console.log('PDF FAIL')

