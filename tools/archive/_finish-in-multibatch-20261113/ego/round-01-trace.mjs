// round-03:点工单号打开追溯,验证「入库单据」按明细行显示多个批次
import { readFileSync } from 'node:fs'
const fixture = JSON.parse(readFileSync('D:/workspace/yinjia/.tmp/fixture-wo.json', 'utf8'))
const WO = fixture.wo
const task = await taskSpace('wo-finishin-multibatch-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
await page.evaluate((wo) => {
  const inp = document.querySelector('input[placeholder="输入查询条件..."]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, wo)
  inp.dispatchEvent(new Event('input', { bubbles: true }))
}, WO)
await sleep(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await sleep(3200)
const opened = await page.evaluate((wo) => {
  const tr = [...document.querySelectorAll('.wol-table .el-table__body tr')].find((x) => (x.textContent || '').includes(wo))
  const link = tr ? [...tr.querySelectorAll('a, .el-link, span')].find((a) => (a.textContent || '').trim() === wo) : null
  if (link) { link.click(); return 'link' }
  if (tr) { tr.click(); return 'row' }
  return 'none'
}, WO)
console.log('openBy=' + opened)
await sleep(4500)
const dlg = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().width > 100)
  const d = dialogs[dialogs.length - 1]
  if (!d) return null
  const title = (d.querySelector('.el-dialog__title') || {}).textContent?.trim() || ''
  const blocks = [...d.querySelectorAll('div')].filter((x) => /\b(wb-|trace)/.test(x.className || '')).map((x) => x.className).slice(0, 12)
  const tables = [...d.querySelectorAll('.el-table')].map((tb) => {
    const ths = [...tb.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
    const rows = [...tb.querySelectorAll('.el-table__body tr')].map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
      const o = {}
      ths.forEach((h, i) => { if (h) o[h] = tds[i] })
      return o
    })
    return { ths, rows: rows.slice(0, 6) }
  })
  return { title, hasIn: (d.textContent || '').includes('入库单据'), classes: blocks, tables: tables.filter((t) => t.ths.includes('批次号') || t.ths.includes('实收数量')) }
})
console.log('dialog=' + JSON.stringify(dlg, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-finishin-multibatch-20261113/r03-trace-dialog.png' })
console.log('pageerrors=' + JSON.stringify(errors))
