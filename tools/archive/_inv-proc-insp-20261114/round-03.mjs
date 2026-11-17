const task = await taskSpace('inv-proc-insp-20261114')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/INV', { timeout: 30000 })
await page.waitForTimeout(8000)
const info = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  const idx = ths.indexOf('是否过程检验')
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')].slice(0, 4).map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    return { code: tds[1], name: tds[2], spec: tds[3], flag: idx >= 0 ? tds[idx] : null, cellCount: tds.length }
  })
  const inputs = [...document.querySelectorAll('input')].map((i) => i.placeholder || '').filter(Boolean).slice(0, 12)
  const btns = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 25)
  return { hash: location.hash, thCount: ths.length, idx, ths: ths.slice(0, 12), rows, inputs, btns }
})
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/inv-proc-insp-20261114/round-03.png' })
