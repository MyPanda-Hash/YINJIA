/**
 * round-07.mjs — 工单排产看板「需交付 / 未交量」界面取证(2026-11-15 第二轮)
 *
 * 断言(4号车间 · GD-2026-11-0028,成型换算率 0.5):
 *   7天需交付 = 25(工序计划量,原来是 50=需求数量)、7天已排 = 25、未交量 = 50(排产 50 − 入库 0,成品口径)
 *   表头 tooltip 存在(需交付/未交量)
 * 视觉证据:Page.printToPDF → PyMuPDF 转 PNG(本机 page.screenshot 出不了帧,见 README G14)
 */
import { writeFileSync } from 'node:fs'
const EV = 'D:/workspace/yinjia/tools/archive/_wo-trace-qty-20261115/ego'
const APP = 'http://127.0.0.1:8090'   // 修复前基线(现役老 jar)
const LINE = process.argv[3] || '4号车间'

const task = await taskSpace('wo-trace-qty-20261115')
const page = task.page('p1')
const results = []
const check = (label, actual, ok) => results.push(`${ok ? '[PASS]' : '[FAIL]'} ${label} = ${JSON.stringify(actual)}`)

// ── 登录 ───────────────────────────────────────────────────────────────
await page.goto(`${APP}/#/`, { timeout: 30000 })
await page.waitForTimeout(4000)
const needLogin = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      if (!el) return
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const sel = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select')
    if (sel) sel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const t = items.find((it) => {
      const x = (it.textContent || '').replace(/\s+/g, '')
      return x.includes('YINJIA-MES') && !x.includes('测试')
    }) || items[0]
    if (t) t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
}
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))

// ── 工单排产页 → 选中 4号车间 ─────────────────────────────────────────────
// ⚠ 必须 reload:ego 的 task page 是**常驻标签页**,`page.goto('#/xxx')` 只是 hash 变更 ⇒
//   新构建的 JS 根本不会重新加载(踩过:重建后界面仍跑旧 chunk,断言假阴性)。
await page.goto(`${APP}/#/prod/plan/workOrderBoard`, { timeout: 45000 })
await page.reload()
await page.waitForTimeout(9000)
console.log('entry = ' + await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => s.src).join(',')))

// 左侧产线列表点「4号车间」(用 DOM 找 + 真实点击)
const clicked = await page.evaluate((ln) => {
  const els = [...document.querySelectorAll('.wb-line-row, .wb-line-name, .wb-left *')]
  const hit = els.find((el) => (el.textContent || '').replace(/\s+/g, '') === ln)
  if (!hit) return false
  hit.setAttribute('data-e2e', 'line-hit')
  return true
}, LINE)
if (clicked) { try { await page.click('[data-e2e="line-hit"]') } catch (e) { console.log('click fallback: ' + e.message) } }
await page.waitForTimeout(7000)

// ── 抓明细表:表头 + 目标行 ────────────────────────────────────────────────
const dom = await page.evaluate(() => {
  const tables = [...document.querySelectorAll('.el-table')].map((tb) => ({
    tb,
    head: [...tb.querySelectorAll('.el-table__header th')].map((th) => ({
      text: (th.textContent || '').replace(/\s+/g, ' ').trim(),
      tip: (th.querySelector('span[title]') || {}).title || '',
    })),
    rows: [...tb.querySelectorAll('.el-table__body tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())),
  }))
  const hit = tables.find((t) => t.head.some((h) => h.text.includes('需交付')) && t.rows.length > 0)
  return hit ? { head: hit.head, rows: hit.rows, count: hit.rows.length } : { head: [], rows: [], count: 0 }
})
console.log('明细表行数 = ' + dom.count)
console.log('列头 = ' + JSON.stringify(dom.head.map((h) => h.text)))
console.log('前 2 行 = ' + JSON.stringify(dom.rows.slice(0, 2)))

const idx = (name) => dom.head.findIndex((h) => h.text.includes(name))
const tip = (name) => (dom.head[idx(name)] || {}).tip || ''
const row = dom.rows[0] || []
const cell = (name) => row[idx(name)]
const numOf = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '') || 0)
check('行存在', dom.count > 0, dom.count > 0)
check('7天需交付(工序计划量)', cell('7天需交付'), numOf(cell('7天需交付')) === 25)
check('需交付三桶合计 = 工序计划量 25', [cell('7天需交付'), cell('15天需交付'), cell('大于15天需交付')].map(numOf).reduce((a, b) => a + b, 0), [cell('7天需交付'), cell('15天需交付'), cell('大于15天需交付')].map(numOf).reduce((a, b) => a + b, 0) === 25)
check('7天已排(同口径)', cell('7天已排'), numOf(cell('7天已排')) === 25)
check('未交量(成品口径)', cell('未交量'), numOf(cell('未交量')) === 50)
check('需交付 表头 tooltip 含「工序计划量」', tip('7天需交付'), tip('7天需交付').includes('工序计划量'))
check('未交量 表头 tooltip 含「成品口径」', tip('未交量'), tip('未交量').includes('成品口径'))

// ── 视觉证据:printToPDF ──────────────────────────────────────────────────
await page.evaluate(() => {
  const st = document.createElement('style')
  st.textContent = `
    body{overflow:visible!important}
    .wb-page,.wb-body,.wb-main{height:auto!important;max-height:none!important;overflow:visible!important}
    .el-table{max-height:none!important;height:auto!important}
    .el-table .el-scrollbar__wrap,.el-table .el-table__body-wrapper{max-height:none!important;overflow:visible!important;height:auto!important}
    .el-table .el-scrollbar__bar{display:none!important}`
  document.head.appendChild(st)
})
await page.waitForTimeout(1200)
try {
  const pdf = await page.cdp('Page.printToPDF', {
    printBackground: true, paperWidth: 26, paperHeight: 12,
    marginTop: 0.2, marginBottom: 0.2, marginLeft: 0.2, marginRight: 0.2, landscape: true,
  })
  const b64 = pdf?.data || pdf?.result?.data
  const name = 'board-need-due-' + (APP.includes('8090') ? '8090-before' : '8091-after') + '.pdf'
  if (b64) { writeFileSync(EV + '/' + name, Buffer.from(b64, 'base64')); console.log('PDF OK ' + name) }
} catch (e) { console.log('PDF fail: ' + e.message) }

console.log('\n' + results.join('\n'))
const fail = results.filter((x) => x.startsWith('[FAIL]')).length
console.log(fail === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fail})`)


